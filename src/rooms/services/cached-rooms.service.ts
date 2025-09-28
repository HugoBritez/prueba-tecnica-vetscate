import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { CreateRoomDto } from '../dto/create-room.dto';
import { RoomResponseDto } from '../dto/room-response.dto';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class CachedRoomsService {
  private readonly logger = new Logger(CachedRoomsService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Creates a new room and invalidates related cache.
   *
   * @param createRoomDto - Room creation data
   * @returns Promise resolving to created room details
   */
  async create(createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    this.logger.log(`Creating room: ${createRoomDto.name}`);

    // Create room in database
    const room = this.roomRepository.create(createRoomDto);
    const savedRoom = await this.roomRepository.save(room);

    // Invalidate rooms cache since we added a new room
    await this.cacheService.del(this.cacheService.keys.rooms.all);

    this.logger.log(`Room created with ID: ${savedRoom.id}`);

    return new RoomResponseDto({
      id: savedRoom.id,
      name: savedRoom.name,
      capacity: savedRoom.capacity,
    });
  }

  /**
   * Gets all rooms with caching strategy.
   * Implements cache-aside pattern with 1-hour TTL.
   *
   * @returns Promise resolving to array of room details
   */
  async findAll(): Promise<RoomResponseDto[]> {
    const cacheKey = this.cacheService.keys.rooms.all;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        this.logger.debug('Cache miss for all rooms, fetching from database');

        const rooms = await this.roomRepository.find({
          order: { name: 'ASC' },
        });

        return rooms.map(
          (room) =>
            new RoomResponseDto({
              id: room.id,
              name: room.name,
              capacity: room.capacity,
            }),
        );
      },
      // Use longer TTL for rooms since they don't change frequently
      3600000, // 1 hour
    );
  }

  /**
   * Gets a specific room by ID with caching.
   *
   * @param id - Room ID
   * @returns Promise resolving to room details or null if not found
   */
  async findById(id: number): Promise<RoomResponseDto | null> {
    const cacheKey = this.cacheService.keys.rooms.byId(id);

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        this.logger.debug(`Cache miss for room ${id}, fetching from database`);

        const room = await this.roomRepository.findOne({
          where: { id },
        });

        if (!room) {
          return null;
        }

        return new RoomResponseDto({
          id: room.id,
          name: room.name,
          capacity: room.capacity,
        });
      },
      // Individual rooms can be cached longer
      3600000, // 1 hour
    );
  }

  /**
   * Checks room availability for a specific date with aggressive caching.
   *
   * This method is called frequently during reservation flows,
   * so it uses shorter TTL to balance performance vs data freshness.
   *
   * @param roomId - Room ID to check
   * @param date - Date string in YYYY-MM-DD format
   * @returns Promise resolving to availability status
   */
  async checkAvailability(
    roomId: number,
    date: string,
  ): Promise<{
    isAvailable: boolean;
    conflictingReservationId?: number;
    fromCache: boolean;
  }> {
    // First check cache
    const cached = await this.cacheService.getRoomAvailability(roomId, date);

    if (cached) {
      this.logger.debug(
        `Room ${roomId} availability for ${date} served from cache`,
      );
      return {
        isAvailable: cached.isAvailable,
        conflictingReservationId: cached.conflictingReservationId,
        fromCache: true,
      };
    }

    // Cache miss - check database
    this.logger.debug(
      `Cache miss for room ${roomId} availability on ${date}, checking database`,
    );

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Query for overlapping reservations
    const conflictingReservation = await this.roomRepository
      .createQueryBuilder('room')
      .leftJoin('room.reservations', 'reservation')
      .where('room.id = :roomId', { roomId })
      .andWhere(
        '(reservation.startTime < :endOfDay AND reservation.endTime > :startOfDay)',
        { startOfDay, endOfDay },
      )
      .select(['room.id', 'reservation.id'])
      .getOne();

    const isAvailable = !conflictingReservation?.reservations?.length;
    const conflictingReservationId =
      conflictingReservation?.reservations?.[0]?.id;

    // Cache the result
    await this.cacheService.cacheRoomAvailability(
      roomId,
      date,
      isAvailable,
      conflictingReservationId,
    );

    return {
      isAvailable,
      conflictingReservationId,
      fromCache: false,
    };
  }

  /**
   * Gets multiple rooms availability for a date range.
   * Optimized for calendar/grid views.
   *
   * @param roomIds - Array of room IDs to check
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Promise resolving to availability matrix
   */
  async getBulkAvailability(
    roomIds: number[],
    startDate: string,
    endDate: string,
  ): Promise<{
    [roomId: number]: {
      [date: string]: {
        isAvailable: boolean;
        conflictingReservationId?: number;
      };
    };
  }> {
    const cacheKey = this.cacheService.keys.reservations.byDateRange(
      startDate,
      endDate,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        this.logger.debug(
          `Cache miss for bulk availability ${startDate} to ${endDate}, fetching from database`,
        );

        const result: any = {};

        // Get all reservations in the date range for the specified rooms
        const reservations = await this.roomRepository
          .createQueryBuilder('room')
          .leftJoin('room.reservations', 'reservation')
          .where('room.id IN (:...roomIds)', { roomIds })
          .andWhere('reservation.startTime <= :endDate', {
            endDate: new Date(`${endDate}T23:59:59.999Z`),
          })
          .andWhere('reservation.endTime >= :startDate', {
            startDate: new Date(`${startDate}T00:00:00.000Z`),
          })
          .select([
            'room.id',
            'reservation.id',
            'reservation.startTime',
            'reservation.endTime',
          ])
          .getMany();

        // Initialize result structure
        roomIds.forEach((roomId) => {
          result[roomId] = {};

          // Generate all dates in range
          const currentDate = new Date(startDate);
          const endDateObj = new Date(endDate);

          while (currentDate <= endDateObj) {
            const dateStr = currentDate.toISOString().split('T')[0];
            result[roomId][dateStr] = { isAvailable: true };
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });

        // Mark conflicting dates
        reservations.forEach((room) => {
          room.reservations?.forEach((reservation) => {
            const resStartDate = new Date(reservation.startTime);
            const resEndDate = new Date(reservation.endTime);

            // Find all dates this reservation affects
            const currentDate = new Date(
              Math.max(resStartDate.getTime(), new Date(startDate).getTime()),
            );
            const endDateForRes = new Date(
              Math.min(resEndDate.getTime(), new Date(endDate).getTime()),
            );

            while (currentDate <= endDateForRes) {
              const dateStr = currentDate.toISOString().split('T')[0];
              if (result[room.id][dateStr]) {
                result[room.id][dateStr] = {
                  isAvailable: false,
                  conflictingReservationId: reservation.id,
                };
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          });
        });

        return result;
      },
      // Bulk availability cached for shorter time due to complexity
      300000, // 5 minutes
    );
  }

  /**
   * Invalidates all cache related to a specific room.
   * Called when room is updated or when reservations change.
   *
   * @param roomId - Room ID to invalidate cache for
   */
  async invalidateRoomCache(roomId: number): Promise<void> {
    await this.cacheService.invalidateRoomCache(roomId);
    this.logger.debug(`Invalidated cache for room ${roomId}`);
  }

  /**
   * Invalidates all rooms cache.
   * Called when rooms are added/removed.
   */
  async invalidateAllRoomsCache(): Promise<void> {
    await this.cacheService.del(this.cacheService.keys.rooms.all);
    this.logger.debug('Invalidated all rooms cache');
  }
}

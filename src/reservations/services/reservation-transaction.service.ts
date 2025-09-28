import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Reservation } from '../entities/reservation.entity';
import { Room } from '../../rooms/entities/room.entity';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ReservationResponseDto } from '../dto/reservation-response.dto';
import { MetricsService } from '../../observability/metrics.service';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class ReservationTransactionService {
  private readonly logger = new Logger(ReservationTransactionService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly dataSource: DataSource,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Creates a reservation using pessimistic locking to prevent race conditions.
   *
   * This method implements a robust solution to the Time-of-Check vs Time-of-Use (TOCTOU)
   * race condition that can occur when multiple users try to book the same room simultaneously.
   *
   * @param createReservationDto - The reservation data including room, start time, and end time
   * @param userId - The ID of the user making the reservation
   *
   * @returns Promise resolving to the created reservation with full details
   *
   * @throws {ConflictException} When the room is already booked for the requested time slot
   * @throws {ConflictException} When the room doesn't exist
   * @throws {ConflictException} When time validation fails (end time before start time, past dates)
   *
   * @example
   * ```typescript
   * const reservation = await service.createReservationWithLocking({
   *   roomId: 1,
   *   startTime: '2024-01-15T14:00:00.000Z',
   *   endTime: '2024-01-15T15:00:00.000Z'
   * }, 123);
   * ```
   *
   * **Race Condition Prevention Strategy:**
   * 1. Uses SERIALIZABLE transaction isolation level for maximum consistency
   * 2. Acquires pessimistic write lock on the target room (blocks other transactions)
   * 3. Validates time constraints within the locked transaction
   * 4. Checks for overlapping reservations with the room still locked
   * 5. Creates reservation atomically before releasing the lock
   *
   * **Concurrency Behavior:**
   * - First request: Acquires lock → validates → creates reservation → releases lock
   * - Concurrent requests: Wait for lock → validate (will fail due to existing reservation) → throw ConflictException
   *
   * **Performance Notes:**
   * - Lock duration is minimized to reduce contention
   * - Only locks the specific room, not the entire table
   * - Includes structured logging for observability and debugging
   */
  async createReservationWithLocking(
    createReservationDto: CreateReservationDto,
    userId: number,
  ): Promise<ReservationResponseDto> {
    const {
      roomId,
      startTime: startTimeStr,
      endTime: endTimeStr,
    } = createReservationDto;

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    const correlationId = this.generateCorrelationId();

    this.logger.log({
      event: 'RESERVATION_ATTEMPT_START',
      correlationId,
      userId,
      roomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    // Track concurrent reservation attempts for race condition monitoring
    this.metricsService.trackConcurrentReservation(roomId, true);

    return await this.dataSource.transaction(
      'SERIALIZABLE', // Máximo nivel de aislamiento
      async (transactionalEntityManager) => {
        try {
          // Paso 1: Bloqueo exclusivo sobre la sala
          this.logger.debug({
            event: 'ACQUIRING_ROOM_LOCK',
            correlationId,
            roomId,
          });

          const room = await transactionalEntityManager
            .createQueryBuilder(Room, 'room')
            .where('room.id = :roomId', { roomId })
            .setLock('pessimistic_write') // Bloqueo exclusivo
            .getOne();

          if (!room) {
            throw new ConflictException('Room not found');
          }

          // Paso 2: Validación básica de tiempo
          this.validateTimeRange(startTime, endTime);

          // Paso 3: Verificación de solapamiento dentro de la transacción
          this.logger.debug({
            event: 'CHECKING_OVERLAPS',
            correlationId,
            roomId,
          });

          const overlappingReservation = await transactionalEntityManager
            .createQueryBuilder(Reservation, 'reservation')
            .where('reservation.roomId = :roomId', { roomId })
            .andWhere(
              '(reservation.startTime < :endTime AND reservation.endTime > :startTime)',
              { startTime, endTime },
            )
            .getOne();

          if (overlappingReservation) {
            this.logger.warn({
              event: 'CONCURRENT_BOOKING_CONFLICT',
              correlationId,
              roomId,
              conflictingReservationId: overlappingReservation.id,
              requestedTimeSlot: { startTime, endTime },
              existingTimeSlot: {
                startTime: overlappingReservation.startTime,
                endTime: overlappingReservation.endTime,
              },
            });

            // Record conflict for metrics
            this.metricsService.recordReservationOperation(
              'create',
              'conflict',
              roomId,
            );
            this.metricsService.trackConcurrentReservation(roomId, false);

            throw new ConflictException(
              'Room is already reserved during this time period - concurrent booking detected',
            );
          }

          // Paso 4: Creación atómica de la reserva
          this.logger.debug({
            event: 'CREATING_RESERVATION',
            correlationId,
            roomId,
            userId,
          });

          const reservation = transactionalEntityManager.create(Reservation, {
            roomId,
            userId,
            startTime,
            endTime,
          });

          const savedReservation =
            await transactionalEntityManager.save(reservation);

          // Paso 5: Cargar relaciones para respuesta
          const fullReservation = await transactionalEntityManager.findOne(
            Reservation,
            {
              where: { id: savedReservation.id },
              relations: ['room', 'user'],
            },
          );

          if (!fullReservation) {
            throw new Error('Failed to retrieve created reservation');
          }

          this.logger.log({
            event: 'RESERVATION_SUCCESS',
            correlationId,
            reservationId: fullReservation.id,
            roomId,
            userId,
            duration: this.calculateDurationMinutes(startTime, endTime),
          });

          // Record successful reservation operation
          this.metricsService.recordReservationOperation(
            'create',
            'success',
            roomId,
          );
          this.metricsService.trackConcurrentReservation(roomId, false);

          // Invalidate cache after successful reservation
          await this.invalidateReservationRelatedCache(
            roomId,
            userId,
            startTime,
            endTime,
          );

          return this.toReservationResponse(fullReservation);
        } catch (error) {
          this.logger.error({
            event: 'RESERVATION_FAILED',
            correlationId,
            error: error.message,
            roomId,
            userId,
          });

          // Record failed operation if not already recorded (for non-conflict errors)
          if (!(error instanceof ConflictException)) {
            this.metricsService.recordReservationOperation(
              'create',
              'failed',
              roomId,
            );
            this.metricsService.trackConcurrentReservation(roomId, false);
          }

          throw error;
        }
      },
    );
  }

  private validateTimeRange(startTime: Date, endTime: Date): void {
    if (endTime <= startTime) {
      throw new ConflictException('End time must be after start time');
    }

    const now = new Date();
    if (startTime < now) {
      throw new ConflictException('Reservation cannot be in the past');
    }
  }

  private toReservationResponse(
    reservation: Reservation,
  ): ReservationResponseDto {
    return new ReservationResponseDto({
      id: reservation.id,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      room: {
        id: reservation.room.id,
        name: reservation.room.name,
        capacity: reservation.room.capacity,
      },
      user: {
        id: reservation.user.id,
        name: reservation.user.name,
        email: reservation.user.email,
      },
    });
  }

  private generateCorrelationId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private calculateDurationMinutes(startTime: Date, endTime: Date): number {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  }

  /**
   * Invalidates cache entries related to a reservation operation.
   * This ensures cache consistency after successful reservations.
   *
   * @param roomId - Room ID affected by the reservation
   * @param userId - User ID who made the reservation
   * @param startTime - Reservation start time
   * @param endTime - Reservation end time
   */
  private async invalidateReservationRelatedCache(
    roomId: number,
    userId: number,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    try {
      // Invalidate room-specific cache
      await this.cacheService.invalidateRoomCache(roomId);

      // Invalidate user-specific cache
      await this.cacheService.invalidateUserCache(userId);

      // Invalidate date-range cache for affected dates
      const startDate = startTime.toISOString().split('T')[0];
      const endDate = endTime.toISOString().split('T')[0];

      // Generate all affected dates
      const affectedDates: string[] = [];
      const currentDate = new Date(startDate);
      const finalDate = new Date(endDate);

      while (currentDate <= finalDate) {
        affectedDates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Invalidate availability cache for each affected date
      for (const date of affectedDates) {
        const availabilityCacheKey = this.cacheService.keys.rooms.availability(
          roomId,
          date,
        );
        await this.cacheService.del(availabilityCacheKey);
      }

      this.logger.debug({
        event: 'CACHE_INVALIDATED',
        roomId,
        userId,
        affectedDates,
        message: 'Cache invalidated after successful reservation',
      });
    } catch (error) {
      // Cache invalidation failures shouldn't break the reservation flow
      this.logger.warn({
        event: 'CACHE_INVALIDATION_FAILED',
        roomId,
        userId,
        error: error.message,
        message: 'Failed to invalidate cache, but reservation was successful',
      });
    }
  }
}

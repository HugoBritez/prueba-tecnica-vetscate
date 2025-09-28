import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { ReservationValidationService } from './services/reservation-validation.service';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly reservationValidationService: ReservationValidationService,
    private readonly roomsService: RoomsService,
  ) {}

  async create(
    createReservationDto: CreateReservationDto,
    userId: number,
  ): Promise<ReservationResponseDto> {
    const {
      roomId,
      startTime: startTimeStr,
      endTime: endTimeStr,
    } = createReservationDto;

    await this.validateRoomExists(roomId);

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    this.reservationValidationService.validateTimeRange(startTime, endTime);
    await this.reservationValidationService.validateNoOverlap(
      roomId,
      startTime,
      endTime,
    );

    const reservation = await this.createReservation({
      roomId,
      userId,
      startTime,
      endTime,
    });

    return this.toReservationResponse(reservation);
  }

  async findByUserId(userId: number): Promise<ReservationResponseDto[]> {
    const reservations = await this.reservationRepository.find({
      where: { userId },
      relations: ['room', 'user'],
      order: { startTime: 'ASC' },
    });

    return reservations.map((reservation) =>
      this.toReservationResponse(reservation),
    );
  }

  async findAll(): Promise<ReservationResponseDto[]> {
    const reservations = await this.reservationRepository.find({
      relations: ['room', 'user'],
      order: { startTime: 'ASC' },
    });

    return reservations.map((reservation) =>
      this.toReservationResponse(reservation),
    );
  }

  private async validateRoomExists(roomId: number): Promise<void> {
    const room = await this.roomsService.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
  }

  private async createReservation(data: {
    roomId: number;
    userId: number;
    startTime: Date;
    endTime: Date;
  }): Promise<Reservation> {
    const reservation = this.reservationRepository.create(data);
    const savedReservation = await this.reservationRepository.save(reservation);

    const result = await this.reservationRepository.findOne({
      where: { id: savedReservation.id },
      relations: ['room', 'user'],
    });

    if (!result) {
      throw new Error('Failed to create reservation');
    }

    return result;
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
}

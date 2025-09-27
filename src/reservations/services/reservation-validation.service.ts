import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from '../entities/reservation.entity';

@Injectable()
export class ReservationValidationService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async validateNoOverlap(
    roomId: number,
    startTime: Date,
    endTime: Date,
    excludeReservationId?: number,
  ): Promise<void> {
    const queryBuilder = this.reservationRepository
      .createQueryBuilder('reservation')
      .where('reservation.roomId = :roomId', { roomId })
      .andWhere(
        '(reservation.startTime < :endTime AND reservation.endTime > :startTime)',
        { startTime, endTime },
      );

    if (excludeReservationId) {
      queryBuilder.andWhere('reservation.id != :excludeReservationId', {
        excludeReservationId,
      });
    }

    const overlappingReservation = await queryBuilder.getOne();

    if (overlappingReservation) {
      throw new BadRequestException(
        'The room is already reserved during this time period',
      );
    }
  }

  validateTimeRange(startTime: Date, endTime: Date): void {
    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const now = new Date();
    if (startTime < now) {
      throw new BadRequestException('Reservation cannot be in the past');
    }
  }
}

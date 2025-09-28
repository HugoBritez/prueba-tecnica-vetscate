import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationValidationService } from './services/reservation-validation.service';
import { ReservationTransactionService } from './services/reservation-transaction.service';
import { Reservation } from './entities/reservation.entity';
import { Room } from '../rooms/entities/room.entity';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Room]), RoomsModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationValidationService,
    ReservationTransactionService,
  ],
  exports: [ReservationsService, ReservationTransactionService],
})
export class ReservationsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationValidationService } from './services/reservation-validation.service';
import { Reservation } from './entities/reservation.entity';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation]), RoomsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationValidationService],
  exports: [ReservationsService],
})
export class ReservationsModule {}

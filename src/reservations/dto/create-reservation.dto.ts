import { IsNotEmpty, IsNumber, IsDateString, Validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsAfterStartTime } from '../validators/is-after-start-time.validator';

export class CreateReservationDto {
  @ApiProperty({
    description: 'Room ID to reserve',
    example: 1,
  })
  @IsNotEmpty({ message: 'Room ID is required' })
  @IsNumber({}, { message: 'Room ID must be a number' })
  roomId: number;

  @ApiProperty({
    description: 'Reservation start time (ISO date string)',
    example: '2024-12-25T09:00:00.000Z',
    format: 'date-time',
  })
  @IsNotEmpty({ message: 'Start time is required' })
  @IsDateString({}, { message: 'Start time must be a valid ISO date string' })
  startTime: string;

  @ApiProperty({
    description: 'Reservation end time (ISO date string)',
    example: '2024-12-25T11:00:00.000Z',
    format: 'date-time',
  })
  @IsNotEmpty({ message: 'End time is required' })
  @IsDateString({}, { message: 'End time must be a valid ISO date string' })
  @Validate(IsAfterStartTime, {
    message: 'End time must be after start time',
  })
  endTime: string;
}

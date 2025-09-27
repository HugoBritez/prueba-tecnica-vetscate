import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name',
    example: 'Conference Room A',
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @ApiProperty({
    description: 'Room capacity (number of people)',
    example: 10,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'Capacity is required' })
  @IsNumber({}, { message: 'Capacity must be a number' })
  @Min(1, { message: 'Capacity must be at least 1' })
  capacity: number;
}

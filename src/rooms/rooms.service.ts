import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async create(createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    await this.validateUniqueName(createRoomDto.name);

    const room = this.roomRepository.create(createRoomDto);
    const savedRoom = await this.roomRepository.save(room);

    return this.toRoomResponse(savedRoom);
  }

  async findAll(): Promise<RoomResponseDto[]> {
    const rooms = await this.roomRepository.find({
      order: { name: 'ASC' },
    });

    return rooms.map((room) => this.toRoomResponse(room));
  }

  async findById(id: number): Promise<Room | null> {
    return this.roomRepository.findOne({ where: { id } });
  }

  private async validateUniqueName(name: string): Promise<void> {
    const existingRoom = await this.roomRepository.findOne({ where: { name } });

    if (existingRoom) {
      throw new ConflictException('Room name already exists');
    }
  }

  private toRoomResponse(room: Room): RoomResponseDto {
    return new RoomResponseDto({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
    });
  }
}

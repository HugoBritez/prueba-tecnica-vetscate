import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CachedRoomsService } from './services/cached-rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedUser {
  userId: number;
  email: string;
  role: string;
}

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly cachedRoomsService: CachedRoomsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new room with cache management',
    description:
      'Creates a room and automatically invalidates related cache entries',
  })
  async create(@Body() createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    return this.cachedRoomsService.create(createRoomDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all rooms (cached)',
    description:
      'Returns all rooms with 1-hour caching for optimal performance',
  })
  async findAll(): Promise<RoomResponseDto[]> {
    return this.cachedRoomsService.findAll();
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiOperation({
    summary: 'Get room by ID (cached)',
    description: 'Returns room details with caching for frequent lookups',
  })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RoomResponseDto | null> {
    return this.cachedRoomsService.findById(id);
  }

  @Get(':id/availability/:date')
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiOperation({
    summary: 'Check room availability for specific date (cached)',
    description:
      'Fast availability check with 5-minute caching for real-time booking flows',
  })
  async checkAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Param('date') date: string,
  ): Promise<{
    isAvailable: boolean;
    conflictingReservationId?: number;
    fromCache: boolean;
  }> {
    return this.cachedRoomsService.checkAvailability(id, date);
  }

  @Get('bulk/availability')
  @ApiQuery({
    name: 'roomIds',
    description: 'Comma-separated room IDs',
    example: '1,2,3',
  })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date (YYYY-MM-DD)',
    example: '2024-01-20',
  })
  @ApiOperation({
    summary: 'Get bulk availability matrix (cached)',
    description:
      'Optimized for calendar views - returns availability for multiple rooms across date range',
  })
  async getBulkAvailability(
    @Query('roomIds') roomIdsStr: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{
    [roomId: number]: {
      [date: string]: {
        isAvailable: boolean;
        conflictingReservationId?: number;
      };
    };
  }> {
    const roomIds = roomIdsStr.split(',').map((id) => parseInt(id.trim(), 10));
    return this.cachedRoomsService.getBulkAvailability(
      roomIds,
      startDate,
      endDate,
    );
  }

  @Post(':id/invalidate-cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiOperation({
    summary: 'Manually invalidate room cache',
    description: 'Force cache invalidation for a specific room (admin utility)',
  })
  async invalidateCache(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.cachedRoomsService.invalidateRoomCache(id);
  }
}

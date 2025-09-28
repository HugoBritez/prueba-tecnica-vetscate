import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { ReservationTransactionService } from './services/reservation-transaction.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedUser {
  userId: number;
  email: string;
  role: string;
}

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly reservationTransactionService: ReservationTransactionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new reservation with race condition protection',
    description:
      'Uses pessimistic locking and SERIALIZABLE transactions to prevent concurrent booking conflicts',
  })
  async create(
    @Body() createReservationDto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationResponseDto> {
    return this.reservationTransactionService.createReservationWithLocking(
      createReservationDto,
      user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get my reservations' })
  async findMyReservations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationResponseDto[]> {
    return this.reservationsService.findByUserId(user.userId);
  }

  @Get('all')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all reservations (Admin only)' })
  async findAllReservations(): Promise<ReservationResponseDto[]> {
    return this.reservationsService.findAll();
  }
}

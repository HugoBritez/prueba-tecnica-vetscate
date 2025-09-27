import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationValidationService } from './services/reservation-validation.service';
import { RoomsService } from '../rooms/rooms.service';
import { Reservation } from './entities/reservation.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Room } from '../rooms/entities/room.entity';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepository: Repository<Reservation>;
  let validationService: ReservationValidationService;
  let roomsService: RoomsService;

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: UserRole.USER,
  };

  const mockRoom = {
    id: 1,
    name: 'Sala A',
    capacity: 10,
  };

  const mockReservation = {
    id: 1,
    startTime: new Date('2024-12-15T09:00:00Z'),
    endTime: new Date('2024-12-15T11:00:00Z'),
    userId: 1,
    roomId: 1,
    user: mockUser,
    room: mockRoom,
  };

  const mockReservationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockValidationService = {
    validateTimeRange: jest.fn(),
    validateNoOverlap: jest.fn(),
  };

  const mockRoomsService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: mockReservationRepository,
        },
        {
          provide: ReservationValidationService,
          useValue: mockValidationService,
        },
        {
          provide: RoomsService,
          useValue: mockRoomsService,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    reservationRepository = module.get<Repository<Reservation>>(
      getRepositoryToken(Reservation),
    );
    validationService = module.get<ReservationValidationService>(
      ReservationValidationService,
    );
    roomsService = module.get<RoomsService>(RoomsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createReservationDto = {
      roomId: 1,
      startTime: '2024-12-15T09:00:00Z',
      endTime: '2024-12-15T11:00:00Z',
    };

    it('should create reservation successfully', async () => {
      mockRoomsService.findById.mockResolvedValue(mockRoom);
      mockValidationService.validateTimeRange.mockReturnValue(undefined);
      mockValidationService.validateNoOverlap.mockResolvedValue(undefined);
      mockReservationRepository.create.mockReturnValue(mockReservation);
      mockReservationRepository.save.mockResolvedValue(mockReservation);
      mockReservationRepository.findOne.mockResolvedValue(mockReservation);

      const result = await service.create(createReservationDto, 1);

      expect(result).toEqual({
        id: 1,
        startTime: new Date('2024-12-15T09:00:00Z'),
        endTime: new Date('2024-12-15T11:00:00Z'),
        room: {
          id: 1,
          name: 'Sala A',
          capacity: 10,
        },
        user: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      expect(mockRoomsService.findById).toHaveBeenCalledWith(1);
      expect(mockValidationService.validateTimeRange).toHaveBeenCalled();
      expect(mockValidationService.validateNoOverlap).toHaveBeenCalled();
    });

    it('should throw NotFoundException if room not found', async () => {
      mockRoomsService.findById.mockResolvedValue(null);

      await expect(service.create(createReservationDto, 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRoomsService.findById).toHaveBeenCalledWith(1);
    });
  });

  describe('findByUserId', () => {
    it('should return user reservations ordered by start time', async () => {
      mockReservationRepository.find.mockResolvedValue([mockReservation]);

      const result = await service.findByUserId(1);

      expect(result).toEqual([
        {
          id: 1,
          startTime: new Date('2024-12-15T09:00:00Z'),
          endTime: new Date('2024-12-15T11:00:00Z'),
          room: {
            id: 1,
            name: 'Sala A',
            capacity: 10,
          },
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]);

      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: ['room', 'user'],
        order: { startTime: 'ASC' },
      });
    });

    it('should return empty array when no reservations found', async () => {
      mockReservationRepository.find.mockResolvedValue([]);

      const result = await service.findByUserId(999);

      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all reservations ordered by start time', async () => {
      mockReservationRepository.find.mockResolvedValue([mockReservation]);

      const result = await service.findAll();

      expect(result).toEqual([
        {
          id: 1,
          startTime: new Date('2024-12-15T09:00:00Z'),
          endTime: new Date('2024-12-15T11:00:00Z'),
          room: {
            id: 1,
            name: 'Sala A',
            capacity: 10,
          },
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]);

      expect(mockReservationRepository.find).toHaveBeenCalledWith({
        relations: ['room', 'user'],
        order: { startTime: 'ASC' },
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Room } from './entities/room.entity';

describe('RoomsService', () => {
  let service: RoomsService;
  let roomRepository: Repository<Room>;

  const mockRoom = {
    id: 1,
    name: 'Sala A',
    capacity: 10,
  };

  const mockRoomRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRoomRepository,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createRoomDto = {
      name: 'Sala A',
      capacity: 10,
    };

    it('should create room successfully', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);
      mockRoomRepository.create.mockReturnValue(mockRoom);
      mockRoomRepository.save.mockResolvedValue(mockRoom);

      const result = await service.create(createRoomDto);

      expect(result).toEqual({
        id: 1,
        name: 'Sala A',
        capacity: 10,
      });
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { name: createRoomDto.name },
      });
      expect(mockRoomRepository.create).toHaveBeenCalledWith(createRoomDto);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(mockRoom);
    });

    it('should throw ConflictException if room name already exists', async () => {
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);

      await expect(service.create(createRoomDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { name: createRoomDto.name },
      });
    });
  });

  describe('findAll', () => {
    it('should return all rooms ordered by name', async () => {
      const rooms = [mockRoom, { id: 2, name: 'Sala B', capacity: 8 }];
      mockRoomRepository.find.mockResolvedValue(rooms);

      const result = await service.findAll();

      expect(result).toEqual([
        { id: 1, name: 'Sala A', capacity: 10 },
        { id: 2, name: 'Sala B', capacity: 8 },
      ]);
      expect(mockRoomRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
    });

    it('should return empty array when no rooms found', async () => {
      mockRoomRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return room when found', async () => {
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);

      const result = await service.findById(1);

      expect(result).toEqual(mockRoom);
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null when room not found', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });
});

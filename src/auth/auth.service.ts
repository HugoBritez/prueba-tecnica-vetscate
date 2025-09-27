import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PasswordService } from './services/password.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    await this.validateUniqueEmail(registerDto.email);

    const user = await this.createUser(registerDto);
    const token = this.generateJwtToken(user);

    return this.buildAuthResponse(user, token);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUserCredentials(loginDto);
    const token = this.generateJwtToken(user);

    return this.buildAuthResponse(user, token);
  }

  private async validateUniqueEmail(email: string): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
  }

  private async createUser(registerDto: RegisterDto): Promise<User> {
    const hashedPassword = await this.passwordService.hashPassword(
      registerDto.password,
    );

    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
    });

    return this.userRepository.save(user);
  }

  private async validateUserCredentials(loginDto: LoginDto): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  private generateJwtToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  private buildAuthResponse(user: User, token: string): AuthResponse {
    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}

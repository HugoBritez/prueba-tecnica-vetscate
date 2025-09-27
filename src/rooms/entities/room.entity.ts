import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Reservation } from '../../reservations/entities/reservation.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'integer' })
  capacity: number;

  @OneToMany(() => Reservation, (reservation) => reservation.room)
  reservations: Reservation[];
}

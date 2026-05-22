import { ApiProperty } from '@nestjs/swagger';

class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'admin', nullable: true })
  username: string | null;

  @ApiProperty({ example: 'admin@gmail.com' })
  email: string;

  @ApiProperty({ example: 'admin' })
  role: string;

  @ApiProperty({ example: true, nullable: true })
  isActive: boolean | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-20T14:00:00.000Z' })
  updatedAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;
}

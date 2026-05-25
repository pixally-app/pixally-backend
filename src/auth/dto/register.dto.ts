import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha1234' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '12345678900' })
  @IsString()
  @IsNotEmpty()
  document: string;

  @ApiProperty({ example: '11999999999' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'user', default: 'user' })
  @IsString()
  @IsOptional()
  role?: string;
}

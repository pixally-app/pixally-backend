import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'joao@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  @MinLength(6)
  @Matches(/[A-Z]/, { message: 'password must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'password must contain at least one special character' })
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

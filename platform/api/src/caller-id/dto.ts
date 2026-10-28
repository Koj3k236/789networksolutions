import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
const trim = ({value}: {value: unknown}) => typeof value === 'string' ? value.trim() : value;
export class EnableRequestDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(10, 2000) justification!: string;
}
export class PermissionSettingsDto {
  @ApiProperty() @IsBoolean() externalCallerIdPassthroughEnabled!: boolean;
  @ApiProperty() @IsBoolean() allowPerCallCallerIdSelection!: boolean;
  @ApiProperty() @IsBoolean() requireAdditionalCallerIdReview!: boolean;
  @ApiProperty() @IsEnum({DISABLED:'DISABLED', APPROVED:'APPROVED', REJECTED:'REJECTED'}) status!: 'DISABLED'|'APPROVED'|'REJECTED';
  @ApiProperty() @Transform(trim) @IsString() @Length(10, 2000) notes!: string;
  @ApiProperty() @IsInt() @Min(0) expectedVersion!: number;
}
export class RequestDecisionDto {
  @ApiProperty() @IsEnum({APPROVED:'APPROVED', REJECTED:'REJECTED'}) decision!: 'APPROVED'|'REJECTED';
  @ApiProperty() @Transform(trim) @IsString() @Length(10,2000) notes!: string;
  @ApiProperty() @IsInt() @Min(0) expectedVersion!: number;
}
export class SubmitNumberDto {
  @ApiProperty() @IsString() @Length(8,32) number!: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(10,2000) authorizationDescription!: string;
}
export class NumberReviewDto {
  @ApiProperty() @IsEnum({AUTHORIZED:'AUTHORIZED', REJECTED:'REJECTED', REVOKED:'REVOKED'}) decision!: 'AUTHORIZED'|'REJECTED'|'REVOKED';
  @ApiProperty() @Transform(trim) @IsString() @Length(10,2000) notes!: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(5,500) evidenceReference?: string;
  @ApiProperty() @IsBoolean() ownershipConfirmed!: boolean;
  @ApiProperty() @IsBoolean() additionalReviewCompleted!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expiresAt?: string;
  @ApiProperty() @IsInt() @Min(0) expectedVersion!: number;
}
export class DefaultCallerIdDto {
  @ApiProperty() @IsOptional() @IsString() @Length(8,32) callerId!: string | null;
}
export class ValidateCallerIdDto {
  @ApiProperty() @IsUUID() trunkId!: string;
  @ApiProperty() @IsString() @MaxLength(32) callerId!: string;
  @ApiProperty() @IsBoolean() perCall!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() carrierId?: string;
}

import {ApiProperty,PartialType} from '@nestjs/swagger';
import {Transform} from 'class-transformer';
import {IsBoolean,IsIn,IsInt,IsOptional,IsString,Length,Matches,Max,Min,ValidateIf} from 'class-validator';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export class CreateTrunkDto {
 @ApiProperty() @Transform(trim) @IsString() @Length(2,80) name!:string;
 @ApiProperty() @ValidateIf((_o,value)=>value!==undefined) @Transform(trim) @IsString() @Length(0,1000) description?:string;
 @ApiProperty() @IsIn(['IP','CREDENTIALS']) authType!:'IP'|'CREDENTIALS';
 @ApiProperty() @IsIn(['UDP','TCP','TLS']) transport!:'UDP'|'TCP'|'TLS';
 @ApiProperty() @Transform(trim) @IsString() @Length(1,253) domain!:string;
 @ApiProperty() @IsInt() @Min(1) @Max(10000) maxConcurrent!:number;
 @ApiProperty() @IsInt() @Min(1) @Max(1000) cps!:number;
 @ApiProperty() @IsOptional() @IsString() @Length(8,32) defaultCallerId?:string|null;
 @ApiProperty() @IsOptional() @IsString() @Length(0,255) @Matches(/^(?:sips?:[a-zA-Z0-9_.+%-]+@[a-zA-Z0-9.-]+(?::\d{1,5})?)?$/) failoverUri?:string|null;
}
export class RevisionDto {@ApiProperty() @IsInt() @Min(0) expectedVersion!:number;}
export class UpdateTrunkDto extends PartialType(CreateTrunkDto,{skipNullProperties:false}){@ApiProperty() @IsInt() @Min(0) expectedVersion!:number;}
export class EnableTrunkDto extends RevisionDto {@ApiProperty() @IsBoolean() enabled!:boolean;}
export class AddIpDto extends RevisionDto {@ApiProperty() @IsString() @Length(3,80) cidr!:string;}
export class AccountLimitsDto {
 @ApiProperty() @IsInt() @Min(1) @Max(10000) concurrent!:number;
 @ApiProperty() @IsInt() @Min(1) @Max(1000) cps!:number;
 @ApiProperty() @Transform(trim) @IsString() @Length(10,1000) reason!:string;
}

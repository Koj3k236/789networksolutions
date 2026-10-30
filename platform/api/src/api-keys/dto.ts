import {ApiProperty} from '@nestjs/swagger';
import {ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsIn,IsInt,IsOptional,IsString,Length,Max,Min} from 'class-validator';
import {Transform} from 'class-transformer';
export const API_SCOPES=['trunks:read','trunks:write','cdr:read','balance:read','caller-id:read'] as const;
export type ApiScope=typeof API_SCOPES[number];
export class CreateApiKeyDto {
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @Length(2,80) name!:string;
 @ApiProperty({enum:API_SCOPES,isArray:true}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @ArrayUnique() @IsIn(API_SCOPES,{each:true}) scopes!:ApiScope[];
 @ApiProperty() @IsOptional() @IsInt() @Min(1) @Max(365) expiresInDays?:number;
}

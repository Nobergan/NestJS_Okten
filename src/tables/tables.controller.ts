import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateTableDto } from './dto/create-table.dto';
import { Table } from './entities/table.entity';
import { TablesService } from './tables.service';
import { UpdateTableDto } from './dto/update-table.dto';
import { ResponseTableDto } from './dto/response-table.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Tables')
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}
  @ApiOperation({ summary: 'create new table' })
  @ApiResponse({
    status: 201,
    type: ResponseTableDto,
  })
  @Post()
  async create(@Body() crateTableDto: CreateTableDto): Promise<Table> {
    return await this.tablesService.create(crateTableDto);
  }

  @Get()
  async findAll(): Promise<ResponseTableDto[]> {
    return this.tablesService.findAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Table> {
    return this.tablesService.findById(+id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTableDto: UpdateTableDto,
  ): Promise<Table> {
    return this.tablesService.update(+id, updateTableDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.tablesService.delete(+id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Table } from './entities/table.entity';
import { Repository } from 'typeorm';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
  ) {}

  async create(createTableDto: CreateTableDto): Promise<Table> {
    const newTable = this.tableRepository.create(createTableDto);
    return this.tableRepository.save(newTable);
  }

  async findAll(): Promise<Table[]> {
    return this.tableRepository.find();
  }

  async findById(id: number): Promise<Table> {
    const table = await this.tableRepository.findOneBy({ id });

    if (!table) {
      throw new NotFoundException(`Table with this ID ${id} not found`);
    }

    return table;
  }

  async update(id: number, updateTableDto: UpdateTableDto): Promise<Table> {
    await this.tableRepository.update(id, updateTableDto);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.tableRepository.delete(id);
  }
}

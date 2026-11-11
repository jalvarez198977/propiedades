import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Patch, HttpCode, HttpStatus, UseInterceptors, UploadedFile, Inject, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/infrastructure/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../../shared/infrastructure/guards/organization.guard';
import { RequireRole } from '../../../shared/infrastructure/decorators/require-role.decorator';
import { CreatePropertyUseCase } from '../application/create-property.use-case';
import { GetPropertiesUseCase } from '../application/get-properties.use-case';
import { UpdatePropertyUseCase } from '../application/update-property.use-case';
import { AssignTenantUseCase } from '../application/assign-tenant.use-case';
import { DeletePropertyUseCase } from '../application/delete-property.use-case';
import { PropertyMeterService } from './property-meter.service';
import { CreatePropertyDto, UpdatePropertyDto, AssignTenantDto, CreatePropertyMeterDto, ReorderPhotosDto, OrganizationRole, TerminateTenancyDto, ReturnDepositDto } from '@propiedades/types';
import { CloudinaryService } from '../../../shared/infrastructure/cloudinary/cloudinary.service';
import { IPropertyRepository, PROPERTY_REPOSITORY } from '../domain/property.repository.port';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('properties')
export class PropertyController {
  constructor(
    private readonly createPropertyUseCase: CreatePropertyUseCase,
    private readonly getPropertiesUseCase: GetPropertiesUseCase,
    private readonly updatePropertyUseCase: UpdatePropertyUseCase,
    private readonly assignTenantUseCase: AssignTenantUseCase,
    private readonly deletePropertyUseCase: DeletePropertyUseCase,
    private readonly propertyMeterService: PropertyMeterService,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(PROPERTY_REPOSITORY) private readonly propertyRepo: IPropertyRepository & { 
      addPhoto: (id: string, data: any) => Promise<any>;
      deletePhoto: (id: string) => Promise<any>;
      getPhoto: (id: string) => Promise<any>;
      updatePhotosOrder: (id: string, data: any) => Promise<void>;
    },
  ) {}

  @Post()
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Crear una nueva propiedad' })
  async create(@Request() req: any, @Body() dto: CreatePropertyDto) {
    return this.createPropertyUseCase.execute(req.user.id, req.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las propiedades' })
  async findAll(@Request() req: any) {
    return this.getPropertiesUseCase.execute(req.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una propiedad' })
  async findOne(@Param('id') id: string) {
    return this.getPropertiesUseCase.executeById(id);
  }

  @Get(':id/active-tenancy')
  @ApiOperation({ summary: 'Obtener el arrendatario activo de una propiedad' })
  async findActiveTenancy(@Param('id') id: string) {
    return this.getPropertiesUseCase.executeActiveTenancy(id);
  }

  @Patch(':id')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Actualizar detalle de una propiedad' })
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdatePropertyDto) {
    return this.updatePropertyUseCase.execute(id, req.organizationId, req.user.id, dto);
  }

  @Post(':id/assign-tenant')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Asignar un inquilino a la propiedad' })
  async assignTenant(@Param('id') id: string, @Request() req: any, @Body() dto: AssignTenantDto) {
    return this.assignTenantUseCase.execute(id, req.organizationId, req.user.id, dto);
  }

  // ── Meters ────────────────────────────────────────────────────────────
  @Get(':id/meters')
  @ApiOperation({ summary: 'Listar medidores de una propiedad' })
  async getMeters(@Param('id') id: string) {
    return this.propertyMeterService.findAllByPropertyId(id);
  }

  @Post(':id/meters')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Agregar un medidor a la propiedad' })
  async addMeter(@Param('id') id: string, @Body() dto: CreatePropertyMeterDto) {
    return this.propertyMeterService.create(id, dto);
  }

  @Delete(':id/meters/:meterId')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un medidor' })
  async deleteMeter(@Param('meterId') meterId: string) {
    return this.propertyMeterService.delete(meterId);
  }

  // ── Photos ────────────────────────────────────────────────────────────
  @Post(':id/photos')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir una foto a la propiedad' })
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    try {
      const result = await this.cloudinaryService.uploadImage(file);
      return await this.propertyRepo.addPhoto(id, result);
    } catch (error: any) {
      console.error("Cloudinary Error:", error);
      throw new BadRequestException(`Error al subir la imagen: ${error.message || 'Verifica tus credenciales de Cloudinary en el archivo .env'}`);
    }
  }

  @Delete(':id/photos/:photoId')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una foto de la propiedad' })
  async deletePhoto(@Param('id') id: string, @Param('photoId') photoId: string) {
    const photo = await this.propertyRepo.getPhoto(photoId);
    if (!photo) throw new BadRequestException('Foto no encontrada');
    
    try {
      await this.cloudinaryService.deleteImage(photo.publicId);
      await this.propertyRepo.deletePhoto(photoId);
    } catch (error) {
      throw new BadRequestException('Error al eliminar la imagen');
    }
  }

  @Delete(':id')
  @RequireRole(OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una propiedad permanentemente' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.deletePropertyUseCase.execute(id, req.organizationId);
  }

  @Patch(':id/photos/order')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Actualizar el orden de las fotos de la propiedad' })
  async updatePhotosOrder(@Param('id') id: string, @Body() dto: ReorderPhotosDto) {
    await this.propertyRepo.updatePhotosOrder(id, dto.photoOrders);
  }

  @Patch(':id/tenancy/:tenancyId/return-deposit')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Marcar el mes de garantía como devuelto' })
  async returnDeposit(@Param('tenancyId') tenancyId: string, @Request() req: any, @Body() dto: ReturnDepositDto) {
    return this.propertyRepo.returnSecurityDeposit(tenancyId, req.organizationId, req.user.id, dto);
  }

  @Patch(':id/tenancy/:tenancyId/security-deposit')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Actualizar el monto del mes de garantía' })
  async updateSecurityDeposit(@Param('tenancyId') tenancyId: string, @Body('amount') amount: number) {
    return this.propertyRepo.updateSecurityDeposit(tenancyId, amount);
  }

  @Patch(':id/tenancy/:tenancyId/monthly-rent')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Actualizar el canon de arriendo mensual' })
  async updateMonthlyRent(
    @Param('tenancyId') tenancyId: string, 
    @Body('amount') amount: number,
    @Body('isIpcAdjustment') isIpcAdjustment?: boolean
  ) {
    return this.propertyRepo.updateMonthlyRent(tenancyId, amount, isIpcAdjustment);
  }

  @Patch(':id/tenancy/:tenancyId/tenant')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Actualizar el inquilino de un contrato' })
  async updateTenancyTenant(@Param('tenancyId') tenancyId: string, @Body('tenantId') tenantId: string) {
    return this.propertyRepo.updateTenancyTenant(tenancyId, tenantId);
  }

  @Patch(':id/tenancy/:tenancyId/start-date')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Actualizar la fecha de inicio de un contrato' })
  async updateTenancyStartDate(@Param('tenancyId') tenancyId: string, @Body('startDate') startDate: string) {
    return this.propertyRepo.updateTenancyStartDate(tenancyId, new Date(startDate));
  }

  @Patch(':id/tenancy/:tenancyId/end-date')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Actualizar la fecha de término de un contrato' })
  async updateTenancyEndDate(@Param('tenancyId') tenancyId: string, @Body('endDate') endDate?: string | null) {
    const parsedDate = endDate ? new Date(endDate) : null;
    return this.propertyRepo.updateTenancyEndDate(tenancyId, parsedDate);
  }

  @Patch(':id/tenancy/:tenancyId/terminate')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Finalizar el contrato de arriendo actual' })
  async terminateTenancy(@Param('tenancyId') tenancyId: string, @Body() dto: TerminateTenancyDto) {
    return this.propertyRepo.terminateTenancy(tenancyId, dto);
  }

  @Post(':id/tenancy/:tenancyId/contract/upload')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir el contrato de arriendo' })
  async uploadContract(@Param('tenancyId') tenancyId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    try {
      const result = await this.cloudinaryService.uploadFile(file);
      await this.propertyRepo.updateTenancyContract(tenancyId, result.url);
      return { url: result.url };
    } catch (error: any) {
      console.error("Cloudinary Contract Upload Error:", error);
      throw new BadRequestException(`Error al subir el contrato: ${error.message || 'Verifica tus credenciales de Cloudinary'}`);
    }
  }

  @Delete(':id/tenancy/:tenancyId/contract')
  @RequireRole(OrganizationRole.ADMIN, OrganizationRole.EDITOR)
  @ApiOperation({ summary: 'Eliminar el contrato de arriendo' })
  async deleteContract(@Param('tenancyId') tenancyId: string) {
    await this.propertyRepo.updateTenancyContract(tenancyId, null);
    return { success: true };
  }
}

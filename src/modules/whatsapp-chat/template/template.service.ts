import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { SendTemplateDto, SendTemplateByNameDto } from './dto/send-template.dto';
import { CreateMetaTemplateDto } from './dto/create-meta-template.dto';
import { UpdateMetaTemplateDto } from './dto/update-meta-template.dto';
import { MetaTemplateService } from './meta-template.service';

interface TemplateComponent {
  type: string;
  parameters?: Array<{
    type: string;
    text?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string };
  }>;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly apiUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metaTemplateService: MetaTemplateService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'WHATSAPP_API_URL',
      'https://graph.facebook.com/v18.0',
    );
    this.phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
      '',
    );
    this.accessToken = this.configService.get<string>(
      'WHATSAPP_ACCESS_TOKEN',
      '',
    );
  }

  /**
   * Crear una nueva plantilla (registro manual)
   */
  async create(createTemplateDto: CreateTemplateDto) {
    const existing = await this.prisma.whatsapp_template.findUnique({
      where: { nombre: createTemplateDto.nombre },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una plantilla con el nombre "${createTemplateDto.nombre}"`,
      );
    }

    return this.prisma.whatsapp_template.create({
      data: {
        nombre: createTemplateDto.nombre,
        idioma: createTemplateDto.idioma || 'es',
        categoria: createTemplateDto.categoria,
        estado: createTemplateDto.estado || 'APPROVED',
        componentes: createTemplateDto.componentes as any,
        variables: createTemplateDto.variables as any,
        descripcion: createTemplateDto.descripcion,
        activo: createTemplateDto.activo ?? true,
      },
    });
  }

  /**
   * Obtener todas las plantillas
   */
  async findAll(filters?: {
    categoria?: string;
    estado?: string;
    activo?: boolean;
  }) {
    const where: any = {};

    if (filters?.categoria) {
      where.categoria = filters.categoria;
    }
    if (filters?.estado) {
      where.estado = filters.estado;
    }
    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    }

    return this.prisma.whatsapp_template.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener plantillas activas y aprobadas (para uso en chats)
   */
  async findApproved() {
    return this.prisma.whatsapp_template.findMany({
      where: {
        estado: 'APPROVED',
        activo: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener una plantilla por ID
   */
  async findOne(id: number) {
    const template = await this.prisma.whatsapp_template.findUnique({
      where: { id_template: id },
    });

    if (!template) {
      throw new NotFoundException(`Plantilla con ID ${id} no encontrada`);
    }

    return template;
  }

  /**
   * Obtener una plantilla por nombre
   */
  async findByName(nombre: string) {
    const template = await this.prisma.whatsapp_template.findUnique({
      where: { nombre },
    });

    if (!template) {
      throw new NotFoundException(`Plantilla "${nombre}" no encontrada`);
    }

    return template;
  }

  /**
   * Actualizar una plantilla
   */
  async update(id: number, updateTemplateDto: UpdateTemplateDto) {
    await this.findOne(id); // Verificar que existe

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (updateTemplateDto.nombre) {
      const existing = await this.prisma.whatsapp_template.findFirst({
        where: {
          nombre: updateTemplateDto.nombre,
          NOT: { id_template: id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Ya existe una plantilla con el nombre "${updateTemplateDto.nombre}"`,
        );
      }
    }

    return this.prisma.whatsapp_template.update({
      where: { id_template: id },
      data: {
        ...updateTemplateDto,
        componentes: updateTemplateDto.componentes as any,
        variables: updateTemplateDto.variables as any,
      },
    });
  }

  /**
   * Eliminar una plantilla
   */
  async remove(id: number) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.whatsapp_template.delete({
      where: { id_template: id },
    });
  }

  /**
   * Enviar mensaje con plantilla a un número de teléfono
   */
  async sendTemplate(
    telefono: string,
    dto: SendTemplateDto | SendTemplateByNameDto,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let template: any;

    if ('id_template' in dto) {
      template = await this.findOne(dto.id_template);
    } else {
      template = await this.findByName(dto.nombre_template);
    }

    if (template.estado !== 'APPROVED') {
      throw new BadRequestException(
        `La plantilla "${template.nombre}" no está aprobada por Meta`,
      );
    }

    if (!template.activo) {
      throw new BadRequestException(
        `La plantilla "${template.nombre}" está desactivada`,
      );
    }

    const idioma = 'idioma' in dto ? dto.idioma : template.idioma;
    const parametros = dto.parametros || {};

    // Construir componentes para la API de Meta
    const components = this.buildTemplateComponents(
      template.componentes,
      parametros,
    );

    // Enviar a la API de WhatsApp
    return this.sendTemplateToWhatsApp(
      telefono,
      template.nombre,
      idioma,
      components,
    );
  }

  /**
   * Construir componentes de plantilla para la API de Meta
   */
  private buildTemplateComponents(
    templateComponentes: any,
    parametros: Record<string, string>,
  ): TemplateComponent[] {
    const components: TemplateComponent[] = [];

    // Header con parámetros
    if (templateComponentes.header) {
      const headerType = templateComponentes.header.type;

      // Header con MEDIA (IMAGE, VIDEO, DOCUMENT)
      // Prioridad: 1) parámetro dinámico, 2) URL guardada en la plantilla (example)
      if (headerType === 'IMAGE') {
        const imageUrl = parametros['header_image'] || templateComponentes.header.example;
        if (imageUrl) {
          components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: imageUrl } }],
          });
        }
      } else if (headerType === 'VIDEO') {
        const videoUrl = parametros['header_video'] || templateComponentes.header.example;
        if (videoUrl) {
          components.push({
            type: 'header',
            parameters: [{ type: 'video', video: { link: videoUrl } }],
          });
        }
      } else if (headerType === 'DOCUMENT') {
        const docUrl = parametros['header_document'] || templateComponentes.header.example;
        if (docUrl) {
          components.push({
            type: 'header',
            parameters: [{ type: 'document', document: { link: docUrl } }],
          });
        }
      }
      // Header con TEXT y variables {{1}}, {{2}}, etc.
      else if (headerType === 'TEXT' || !headerType) {
        const headerParams = this.extractParameters(
          templateComponentes.header.text || '',
          parametros,
          'header_',
        );

        if (headerParams.length > 0) {
          components.push({
            type: 'header',
            parameters: headerParams.map((text) => ({ type: 'text', text })),
          });
        }
      }
    }

    // Body con parámetros
    if (templateComponentes.body) {
      const bodyParams = this.extractParameters(
        templateComponentes.body.text || '',
        parametros,
        'body_',
      );

      if (bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        });
      }
    }

    // Botones con parámetros dinámicos (ej: URLs dinámicas)
    if (
      templateComponentes.buttons &&
      Array.isArray(templateComponentes.buttons)
    ) {
      templateComponentes.buttons.forEach((button: any, index: number) => {
        if (button.type === 'URL' && button.url?.includes('{{')) {
          const urlParam = parametros[`button_${index}_url`];
          if (urlParam) {
            components.push({
              type: 'button',
              parameters: [{ type: 'text', text: urlParam }],
            });
          }
        }
      });
    }

    return components;
  }

  /**
   * Extraer parámetros de un texto con variables {{1}}, {{2}}, etc.
   */
  private extractParameters(
    text: string,
    parametros: Record<string, string>,
    prefix: string,
  ): string[] {
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [...text.matchAll(regex)];
    const params: string[] = [];

    for (const match of matches) {
      const index = match[1];
      const paramKey = `${prefix}${index}`;
      const altKey = index; // También buscar sin prefijo

      const value =
        parametros[paramKey] || parametros[altKey] || `[Variable ${index}]`;
      params.push(value);
    }

    return params;
  }

  /**
   * Enviar plantilla a la API de WhatsApp
   */
  private async sendTemplateToWhatsApp(
    telefono: string,
    templateName: string,
    language: string,
    components: TemplateComponent[],
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        'WhatsApp API not configured. Template not sent to: ' + telefono,
      );
      // Retornar mock para desarrollo
      return {
        success: true,
        messageId: `mock_template_${Date.now()}`,
      };
    }

    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      to: telefono.replace('+', ''),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language,
        },
      },
    };

    // Solo agregar components si hay parámetros
    if (components.length > 0) {
      body.template.components = components;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('WhatsApp API response status:', body);
      const data = await response.json();

      if (!response.ok) {
        this.logger.error(
          `WhatsApp API error: ${data.error?.message || 'Unknown error'}`,
        );
        return {
          success: false,
          error: data.error?.message || 'Error al enviar plantilla',
        };
      }

      const messageId = data.messages?.[0]?.id;
      this.logger.log(`Template sent successfully. ID: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send template: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Preview de cómo se verá una plantilla con los parámetros
   */
  previewTemplate(
    template: any,
    parametros: Record<string, string>,
  ): { header?: string; body: string; footer?: string } {
    const result: { header?: string; body: string; footer?: string } = {
      body: '',
    };

    const componentes = template.componentes;

    // Procesar header
    if (componentes.header?.text) {
      result.header = this.replaceVariables(
        componentes.header.text,
        parametros,
        'header_',
      );
    }

    // Procesar body
    if (componentes.body?.text) {
      result.body = this.replaceVariables(
        componentes.body.text,
        parametros,
        'body_',
      );
    }

    // Procesar footer (generalmente sin variables)
    if (componentes.footer?.text) {
      result.footer = componentes.footer.text;
    }

    return result;
  }

  /**
   * Reemplazar variables en un texto
   */
  private replaceVariables(
    text: string,
    parametros: Record<string, string>,
    prefix: string,
  ): string {
    return text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
      const paramKey = `${prefix}${index}`;
      const altKey = index;
      return parametros[paramKey] || parametros[altKey] || match;
    });
  }

  // ==================== INTEGRACIÓN CON META API ====================

  /**
   * Crear plantilla en Meta y guardar localmente
   */
  async createInMeta(dto: CreateMetaTemplateDto) {
    // Validar nombre único
    const existing = await this.prisma.whatsapp_template.findUnique({
      where: { nombre: dto.nombre },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe una plantilla con el nombre "${dto.nombre}"`,
      );
    }

    // Construir componentes en formato local
    const componentes = {
      header: dto.header,
      body: dto.body,
      footer: dto.footer,
      buttons: dto.buttons,
    };

    // Construir componentes para Meta API
    const metaComponents = this.metaTemplateService.buildMetaComponents(componentes);

    // Crear en Meta
    this.logger.log(`Creating template in Meta: ${dto.nombre}`);
    const metaResponse = await this.metaTemplateService.createTemplate({
      name: dto.nombre,
      category: dto.categoria,
      language: dto.idioma || 'es',
      components: metaComponents,
    });

    // Extraer variables
    const variables = this.metaTemplateService.extractVariables(componentes);

    // Guardar localmente
    return this.prisma.whatsapp_template.create({
      data: {
        meta_template_id: metaResponse.id,
        nombre: dto.nombre,
        idioma: dto.idioma || 'es',
        categoria: dto.categoria,
        estado: metaResponse.status || 'PENDING',
        componentes: componentes as any,
        variables: variables as any,
        descripcion: dto.descripcion,
        activo: dto.activo ?? true,
        sincronizado_con_meta: true,
        ultima_sincronizacion: new Date(),
      },
    });
  }

  /**
   * Editar plantilla en Meta
   */
  async updateInMeta(id: number, dto: UpdateMetaTemplateDto) {
    const template = await this.findOne(id);

    if (!template.meta_template_id) {
      throw new BadRequestException(
        'Esta plantilla no está sincronizada con Meta. Use el endpoint normal para actualizarla.',
      );
    }

    // Construir nuevos componentes (merge con existentes)
    const existingComp = template.componentes as any;
    const componentes = {
      header: dto.header || existingComp?.header,
      body: dto.body || existingComp?.body,
      footer: dto.footer || existingComp?.footer,
      buttons: dto.buttons || existingComp?.buttons,
    };

    // Construir componentes para Meta API
    const metaComponents = this.metaTemplateService.buildMetaComponents(componentes);

    // Actualizar en Meta
    this.logger.log(`Updating template in Meta: ${template.nombre}`);
    await this.metaTemplateService.updateTemplate(
      template.meta_template_id,
      metaComponents,
    );

    // Extraer variables
    const variables = this.metaTemplateService.extractVariables(componentes);

    // Actualizar localmente
    return this.prisma.whatsapp_template.update({
      where: { id_template: id },
      data: {
        componentes: componentes as any,
        variables: variables as any,
        descripcion: dto.descripcion ?? template.descripcion,
        activo: dto.activo ?? template.activo,
        estado: 'PENDING', // Al editar, vuelve a revisión
        ultima_sincronizacion: new Date(),
      },
    });
  }

  /**
   * Eliminar plantilla de Meta y localmente
   */
  async deleteFromMeta(id: number) {
    const template = await this.findOne(id);

    // Si está sincronizado con Meta, eliminar de allá también
    if (template.meta_template_id && template.sincronizado_con_meta) {
      this.logger.log(`Deleting template from Meta: ${template.nombre}`);
      try {
        await this.metaTemplateService.deleteTemplate(template.nombre);
      } catch (error) {
        this.logger.warn(
          `Could not delete from Meta (may already be deleted): ${error.message}`,
        );
      }
    }

    // Eliminar localmente
    return this.prisma.whatsapp_template.delete({
      where: { id_template: id },
    });
  }

  /**
   * Sincronizar todas las plantillas desde Meta
   */
  async syncFromMeta(): Promise<{
    created: number;
    updated: number;
    errors: string[];
  }> {
    this.logger.log('Syncing all templates from Meta...');
    const metaTemplates = await this.metaTemplateService.getTemplates();

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const metaTemplate of metaTemplates) {
      try {
        // Buscar si ya existe localmente
        const existing = await this.prisma.whatsapp_template.findFirst({
          where: {
            OR: [
              { meta_template_id: metaTemplate.id },
              { nombre: metaTemplate.name },
            ],
          },
        });

        // Parsear componentes de Meta a formato local
        const componentes = this.metaTemplateService.parseMetaComponents(
          metaTemplate.components,
        );
        const variables = this.metaTemplateService.extractVariables(componentes);

        if (existing) {
          // Actualizar existente
          await this.prisma.whatsapp_template.update({
            where: { id_template: existing.id_template },
            data: {
              meta_template_id: metaTemplate.id,
              estado: metaTemplate.status,
              reject_reason: metaTemplate.rejected_reason,
              componentes: componentes as any,
              variables: variables as any,
              sincronizado_con_meta: true,
              ultima_sincronizacion: new Date(),
            },
          });
          results.updated++;
        } else {
          // Crear nueva
          await this.prisma.whatsapp_template.create({
            data: {
              meta_template_id: metaTemplate.id,
              nombre: metaTemplate.name,
              idioma: metaTemplate.language,
              categoria: metaTemplate.category,
              estado: metaTemplate.status,
              reject_reason: metaTemplate.rejected_reason,
              componentes: componentes as any,
              variables: variables as any,
              activo: true,
              sincronizado_con_meta: true,
              ultima_sincronizacion: new Date(),
            },
          });
          results.created++;
        }
      } catch (error) {
        const errorMsg = `Error con plantilla ${metaTemplate.name}: ${error.message}`;
        this.logger.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    this.logger.log(
      `Sync completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
    );
    return results;
  }

  /**
   * Sincronizar una plantilla específica desde Meta
   */
  async syncOneFromMeta(id: number) {
    const template = await this.findOne(id);

    if (!template.meta_template_id) {
      throw new BadRequestException(
        'Esta plantilla no tiene ID de Meta. No se puede sincronizar.',
      );
    }

    this.logger.log(`Syncing template from Meta: ${template.nombre}`);
    const metaTemplate = await this.metaTemplateService.getTemplateById(
      template.meta_template_id,
    );

    // Parsear componentes
    const componentes = this.metaTemplateService.parseMetaComponents(
      metaTemplate.components,
    );
    const variables = this.metaTemplateService.extractVariables(componentes);

    // Actualizar localmente
    return this.prisma.whatsapp_template.update({
      where: { id_template: id },
      data: {
        estado: metaTemplate.status,
        reject_reason: metaTemplate.rejected_reason,
        componentes: componentes as any,
        variables: variables as any,
        sincronizado_con_meta: true,
        ultima_sincronizacion: new Date(),
      },
    });
  }
}

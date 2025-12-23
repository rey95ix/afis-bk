import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: any[];
  example?: any;
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
}

interface MetaTemplateResponse {
  id: string;
  status: string;
  category: string;
}

interface MetaTemplateListResponse {
  data: MetaTemplate[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaTemplateComponent[];
  rejected_reason?: string;
  quality_score?: { score: string; date: number };
}

@Injectable()
export class MetaTemplateService {
  private readonly logger = new Logger(MetaTemplateService.name);
  private readonly apiUrl: string;
  private readonly wabaId: string;
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'WHATSAPP_API_URL',
      'https://graph.facebook.com/v18.0',
    );
    this.wabaId = this.configService.get<string>('WHATSAPP_WABA_ID', '');
    this.accessToken = this.configService.get<string>(
      'WHATSAPP_ACCESS_TOKEN',
      '',
    );
  }

  /**
   * Crear plantilla en Meta
   */
  async createTemplate(data: {
    name: string;
    category: string;
    language: string;
    components: MetaTemplateComponent[];
  }): Promise<MetaTemplateResponse> {
    const url = `${this.apiUrl}/${this.wabaId}/message_templates`;

    const body = {
      name: data.name,
      category: data.category,
      language: data.language,
      components: data.components,
    };

    this.logger.log(`Creating template in Meta: ${data.name}`);
    return this.makeRequest<MetaTemplateResponse>('POST', url, body);
  }

  /**
   * Editar plantilla en Meta (solo componentes, no nombre/categoria)
   */
  async updateTemplate(
    templateId: string,
    components: MetaTemplateComponent[],
  ): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/${templateId}`;
    return this.makeRequest<{ success: boolean }>('POST', url, { components });
  }

  /**
   * Eliminar plantilla de Meta por nombre
   */
  async deleteTemplate(name: string): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/${this.wabaId}/message_templates?name=${encodeURIComponent(name)}`;
    return this.makeRequest<{ success: boolean }>('DELETE', url);
  }

  /**
   * Eliminar plantilla de Meta por ID
   */
  async deleteTemplateById(
    hsmId: string,
    name: string,
  ): Promise<{ success: boolean }> {
    const url = `${this.apiUrl}/${this.wabaId}/message_templates?hsm_id=${hsmId}&name=${encodeURIComponent(name)}`;
    return this.makeRequest<{ success: boolean }>('DELETE', url);
  }

  /**
   * Obtener todas las plantillas desde Meta
   */
  async getTemplates(): Promise<MetaTemplate[]> {
    const url = `${this.apiUrl}/${this.wabaId}/message_templates?limit=100`;
    const response =
      await this.makeRequest<MetaTemplateListResponse>('GET', url);
    return response.data || [];
  }

  /**
   * Obtener una plantilla específica desde Meta por ID
   */
  async getTemplateById(templateId: string): Promise<MetaTemplate> {
    const url = `${this.apiUrl}/${templateId}`;
    return this.makeRequest<MetaTemplate>('GET', url);
  }

  /**
   * Obtener plantilla por nombre
   */
  async getTemplateByName(name: string): Promise<MetaTemplate | null> {
    const url = `${this.apiUrl}/${this.wabaId}/message_templates?name=${encodeURIComponent(name)}`;
    const response =
      await this.makeRequest<MetaTemplateListResponse>('GET', url);
    return response.data?.[0] || null;
  }

  /**
   * Helper para hacer requests a Meta API
   */
  private async makeRequest<T>(
    method: string,
    url: string,
    body?: any,
  ): Promise<T> {
    if (!this.wabaId || !this.accessToken) {
      throw new HttpException(
        'WhatsApp Business Account no configurado. Verifique WHATSAPP_WABA_ID y WHATSAPP_ACCESS_TOKEN.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(`Meta API Request: ${method} ${url}`);
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Meta API error: ${JSON.stringify(data.error)}`);
        throw new HttpException(
          data.error?.message || 'Error en Meta API',
          HttpStatus.BAD_REQUEST,
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Meta API request failed: ${error.message}`);
      throw new HttpException(
        `Error de conexión con Meta API: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Convertir componentes del formato local al formato de Meta API
   */
  buildMetaComponents(componentes: any): MetaTemplateComponent[] {
    const components: MetaTemplateComponent[] = [];

    // Header
    if (componentes.header) {
      const header: MetaTemplateComponent = {
        type: 'HEADER',
        format: componentes.header.type,
      };

      if (componentes.header.type === 'TEXT') {
        header.text = componentes.header.text;
        if (componentes.header.example) {
          header.example = { header_text: [componentes.header.example] };
        }
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(componentes.header.type)) {
        if (componentes.header.example) {
          header.example = { header_handle: [componentes.header.example] };
        }
      }
      // LOCATION no necesita ejemplo

      components.push(header);
    }

    // Body (requerido)
    if (componentes.body) {
      const body: MetaTemplateComponent = {
        type: 'BODY',
        text: componentes.body.text,
      };

      // Agregar ejemplos si hay variables
      if (
        componentes.body.examples &&
        Array.isArray(componentes.body.examples) &&
        componentes.body.examples.length > 0
      ) {
        body.example = { body_text: [componentes.body.examples] };
      }

      components.push(body);
    }

    // Footer
    if (componentes.footer?.text) {
      components.push({
        type: 'FOOTER',
        text: componentes.footer.text,
      });
    }

    // Buttons
    if (componentes.buttons && componentes.buttons.length > 0) {
      const buttons = componentes.buttons.map((btn: any) => {
        const button: any = {
          type: btn.type,
          text: btn.text,
        };

        switch (btn.type) {
          case 'URL':
            button.url = btn.url;
            if (btn.example) {
              button.example = [btn.example];
            }
            break;
          case 'PHONE_NUMBER':
            button.phone_number = btn.phone_number;
            break;
          case 'QUICK_REPLY':
            // No extra fields needed
            break;
          case 'COPY_CODE':
            button.example = btn.example ? [btn.example] : ['CODE123'];
            break;
          case 'OTP':
            button.otp_type = btn.otp_type || 'COPY_CODE';
            if (btn.otp_type === 'ONE_TAP') {
              button.autofill_text = btn.autofill_text;
              button.package_name = btn.package_name;
              button.signature_hash = btn.signature_hash;
            }
            break;
        }

        return button;
      });

      components.push({
        type: 'BUTTONS',
        buttons,
      });
    }

    return components;
  }

  /**
   * Parsear componentes de Meta al formato local
   */
  parseMetaComponents(metaComponents: MetaTemplateComponent[]): any {
    const result: any = {};

    for (const comp of metaComponents) {
      switch (comp.type) {
        case 'HEADER':
          result.header = {
            type: comp.format,
            text: comp.text,
            example:
              comp.example?.header_text?.[0] ||
              comp.example?.header_handle?.[0],
          };
          break;

        case 'BODY':
          result.body = {
            text: comp.text,
            examples: comp.example?.body_text?.[0],
          };
          break;

        case 'FOOTER':
          result.footer = { text: comp.text };
          break;

        case 'BUTTONS':
          result.buttons = comp.buttons?.map((btn: any) => ({
            type: btn.type,
            text: btn.text,
            url: btn.url,
            phone_number: btn.phone_number,
            example: btn.example?.[0],
            otp_type: btn.otp_type,
            autofill_text: btn.autofill_text,
            package_name: btn.package_name,
            signature_hash: btn.signature_hash,
          }));
          break;
      }
    }

    return result;
  }

  /**
   * Extraer variables de los componentes
   */
  extractVariables(componentes: any): Record<string, string> {
    const variables: Record<string, string> = {};
    const regex = /\{\{(\d+)\}\}/g;

    // Header
    if (componentes.header?.text) {
      let match;
      const headerRegex = new RegExp(regex.source, regex.flags);
      while ((match = headerRegex.exec(componentes.header.text)) !== null) {
        variables[`header_${match[1]}`] = `Variable de encabezado ${match[1]}`;
      }
    }

    // Body
    if (componentes.body?.text) {
      let match;
      const bodyRegex = new RegExp(regex.source, regex.flags);
      while ((match = bodyRegex.exec(componentes.body.text)) !== null) {
        variables[`body_${match[1]}`] = `Variable de cuerpo ${match[1]}`;
      }
    }

    // URL buttons with variables
    if (componentes.buttons) {
      componentes.buttons.forEach((btn: any, index: number) => {
        if (btn.type === 'URL' && btn.url?.includes('{{')) {
          variables[`button_${index}_url`] = `URL dinámica del botón ${index + 1}`;
        }
      });
    }

    return variables;
  }
}

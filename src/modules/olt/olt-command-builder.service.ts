import { Injectable } from '@nestjs/common';
import {
  OltSlotPortOnt,
  OltInstallParams,
  OltDeleteParams,
  OltPlanChangeParams,
} from './interfaces/olt-command.interface';

@Injectable()
export class OltCommandBuilderService {
  
  buildResetCommand(params: OltSlotPortOnt): string {
    const lines = [
      'enable',
      'config',
      `interface gpon 0/${params.slot}`,
      `ont reset ${params.port} ${params.ontId}`,
      'y',
      'quit',
      'quit',
      'quit',
    ];
    return lines.join('\n');
  }

  buildDisplayWanInfoCommand(params: OltSlotPortOnt): string {
    const lines = [
      'enable',
      'config',
      `display ont wan-info 0/${params.slot} ${params.port} ${params.ontId}`,
      'quit',
      'quit',
    ];
    return lines.join('\n');
  }

  buildInstallCommand(params: OltInstallParams): string {
    const lines = ['enable', 'config', `interface gpon 0/${params.slot}`];

    if (params.tipoAuth === 'SN') {
      lines.push(
        `ont add ${params.port} ${params.ontId} sn-auth ${params.sn} omci ont-lineprofile-id ${params.srvprofileOlt || '1'} ont-srvprofile-id ${params.srvprofileOlt || '1'} desc client_${params.ontId}`,
      );
    } else {
      lines.push(
        `ont add ${params.port} ${params.ontId} loid-auth ${params.password} always-on omci ont-lineprofile-id ${params.srvprofileOlt || '1'} ont-srvprofile-id ${params.srvprofileOlt || '1'} desc client_${params.ontId}`,
      );
    }

    lines.push('y');
    lines.push('quit');

    // Service port configuration
    lines.push(
      `service-port ${params.serviceport} vlan ${params.vlan} gpon 0/${params.slot}/${params.port} ont ${params.ontId} gemport 1 multi-service user-vlan ${params.userVlan} tag-transform translate`,
    );

    lines.push('quit');
    lines.push('quit');

    return lines.join('\n');
  }

  buildDeleteCommand(params: OltDeleteParams): string {
    const lines = [
      'enable',
      'config',
      `undo service-port ${params.serviceport}`,
      'y',
      `interface gpon 0/${params.slot}`,
      `ont delete ${params.port} ${params.ontId}`,
      'y',
      'quit',
      'quit',
      'quit',
    ];
    return lines.join('\n');
  }

  buildDeactivateCommand(params: OltSlotPortOnt): string {
    const lines = [
      'enable',
      'config',
      `interface gpon 0/${params.slot}`,
      `ont deactivate ${params.port} ${params.ontId}`,
      'y',
      'quit',
      'quit',
      'quit',
    ];
    return lines.join('\n');
  }

  buildActivateCommand(params: OltSlotPortOnt): string {
    const lines = [
      'enable',
      'config',
      `interface gpon 0/${params.slot}`,
      `ont activate ${params.port} ${params.ontId}`,
      'y',
      'quit',
      'quit',
      'quit',
    ];
    return lines.join('\n');
  }

  buildAutofindAllCommand(): string {
    const lines = [
      'enable', 
      'display ont autofind all',
      'quit',
      'y',
    ];
    return lines.join('\n');
  }

  buildPlanChangeCommand(params: OltPlanChangeParams): string {
    const lines = [
      'enable',
      'config',
      `interface gpon 0/${params.slot}`,
      `ont modify ${params.port} ${params.ontId} ont-lineprofile-id ${params.idTraficoDown}`,
      'y',
      'quit',
      `service-port ${params.serviceport} inbound traffic-table index ${params.idTraficoUp} outbound traffic-table index ${params.idTraficoDown}`,
      'quit',
      'quit',
    ];
    return lines.join('\n');
  }
}

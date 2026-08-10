import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ReceiptData {
  id_transferencia: string;
  data_hora: string;
  valor: string;
  descricao: string;
  destino_nome: string;
  destino_documento: string;
  destino_tipo_documento: string;
  destino_instituicao_bancaria: string;
  destino_agencia: string;
  destino_conta: string;
  destino_tipo_conta: string;
  destino_chave_pix: string;
  origem_nome: string;
  origem_documento: string;
  origem_tipo_documento: string;
  origem_instituicao_bancaria: string;
  origem_agencia: string;
  origem_conta: string;
  error?: string;
}

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenAiService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow('OPENAI_API_KEY'),
    });
  }

  async analyzeReceipt(fileUrl: string, ocrText: string): Promise<ReceiptData> {
    this.logger.log('Enviando comprovante para o GPT-4o');

    const prompt = `Dado este comprovante de transferência bancária e sua respectiva extração de OCR (texto), o seu trabalho é cruzar as duas fontes de informação para extrair os dados com a melhor precisão possível em um formato JSON sem níveis de aninhamento.

O formato final do JSON deve ser:

{
    "id_transferencia": "",
    "data_hora": "",
    "valor": "",
    "descricao": "",
    "destino_nome": "",
    "destino_documento": "",
    "destino_tipo_documento": "",
    "destino_instituicao_bancaria": "",
    "destino_agencia": "",
    "destino_conta": "",
    "destino_tipo_conta": "",
    "destino_chave_pix": "",
    "origem_nome": "",
    "origem_documento": "",
    "origem_tipo_documento": "",
    "origem_instituicao_bancaria": "",
    "origem_agencia": "",
    "origem_conta": ""
}

IMPORTANTE:
- A data/hora deve estar sempre no formato ISO "YYYY-MM-DDTHH:mm:ss"
- O campo "descricao" deve conter a mensagem ou descrição informada pelo pagador. Ela pode aparecer com rótulos variados ("Descrição", "Mensagem", "Referência", "Motivo") ou sem nenhum rótulo — neste caso costuma ser um texto curto logo abaixo do valor ou da data. Se não houver descrição, deixe vazio.
- O JSON deve ser válido, sem comentários e sem chaves duplicadas
- Se não conseguir processar, responda apenas com: { "error": "mensagem aqui" }
- Seja sucinto, envie apenas o JSON`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: fileUrl } },
            { type: 'text', text: `Aqui está a extração do OCR:\n${ocrText}` },
          ],
        },
      ],
    });

    const raw = response.choices[0].message.content ?? '';
    this.logger.log('Resposta recebida do GPT-4o');

    return this.parseJson(raw);
  }

  private parseJson(raw: string): ReceiptData {
    const cleaned = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(cleaned) as ReceiptData;
    } catch {
      this.logger.error(`GPT retornou resposta não-JSON: ${cleaned.slice(0, 200)}`);
      return { error: 'Resposta inválida do GPT' } as ReceiptData;
    }
  }
}

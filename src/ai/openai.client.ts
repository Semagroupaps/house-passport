import { Injectable } from '@nestjs/common';

/** Tynd HTTP-klient til OpenAI (eller kompatibelt API). Ingen SDK — kun fetch. */
@Injectable()
export class OpenAiClient {
  private readonly base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  private readonly key = process.env.OPENAI_API_KEY || '';
  private readonly chatModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  private readonly embedModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  private readonly visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';

  static isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
  isConfigured(): boolean {
    return !!this.key;
  }

  private headers() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` };
  }

  async chat(system: string, user: string, json = false): Promise<string> {
    const r = await fetch(this.base + '/chat/completions', {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({
        model: this.chatModel, temperature: 0,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!r.ok) throw new Error('OpenAI chat ' + r.status);
    const d: any = await r.json();
    return d.choices?.[0]?.message?.content ?? '';
  }

  async visionOcr(dataUri: string): Promise<string> {
    const r = await fetch(this.base + '/chat/completions', {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({
        model: this.visionModel, temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Transskribér al tekst i dette dokument ordret på dansk. Returnér kun teksten.' },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error('OpenAI vision ' + r.status);
    const d: any = await r.json();
    return d.choices?.[0]?.message?.content ?? '';
  }

  async embed(text: string): Promise<number[]> {
    const r = await fetch(this.base + '/embeddings', {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model: this.embedModel, input: text.slice(0, 8000) }),
    });
    if (!r.ok) throw new Error('OpenAI embeddings ' + r.status);
    const d: any = await r.json();
    return d.data?.[0]?.embedding ?? [];
  }
}

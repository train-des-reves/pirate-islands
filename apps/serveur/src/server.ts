import { createServer, type Server as ServeurHttp } from 'node:http';

import { Server as ServeurColyseus } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import type { Request, Response } from 'express';

import { creerReponseSante } from '@pirate/protocole';

export interface OptionsServeur {
  readonly host?: string;
  readonly port?: number;
}

export interface ServeurDemarre {
  readonly host: string;
  readonly port: number;
  readonly url: string;
  readonly http: ServeurHttp;
  readonly colyseus: ServeurColyseus;
  readonly arreter: () => Promise<void>;
}

export async function démarrerServeur(options: OptionsServeur = {}): Promise<ServeurDemarre> {
  const host = options.host ?? process.env.SERVER_HOST ?? '127.0.0.1';
  const port = options.port ?? Number.parseInt(process.env.SERVER_PORT ?? '2567', 10);
  const http = createServer();
  const transport = new WebSocketTransport({ server: http });
  const colyseus = new ServeurColyseus({
    express: (application) => {
      application.get('/health', (_requête: Request, réponse: Response) => {
        réponse
          .status(200)
          .set({
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          })
          .json(creerReponseSante());
      });
    },
    gracefullyShutdown: false,
    greet: false,
    transport,
  });

  await colyseus.listen(port, host);

  const adresse = http.address();
  const portEffectif = typeof adresse === 'object' && adresse !== null ? adresse.port : port;

  return {
    host,
    port: portEffectif,
    url: `http://${host}:${portEffectif}`,
    http,
    colyseus,
    arreter: async () => {
      if (!http.listening) {
        return;
      }

      await new Promise<void>((résoudre, rejeter) => {
        http.close((erreur) => (erreur ? rejeter(erreur) : résoudre()));
      });
    },
  };
}

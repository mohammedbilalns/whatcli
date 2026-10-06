import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { Database } from 'better-sqlite3';

export async function useSqliteAuthState(db: Database): Promise<{ state: AuthenticationState, saveCreds: () => void }> {
  const readData = (name: string) => {
    try {
      const row = db.prepare('SELECT data FROM auth_state WHERE name = ?').get(name) as { data: string } | undefined;
      if (row) {
        return JSON.parse(row.data, BufferJSON.reviver);
      }
    } catch (error) {
      // return null below
    }
    return null;
  };

  const writeData = (name: string, data: any) => {
    db.prepare(`
      INSERT INTO auth_state (name, data) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET data = excluded.data
    `).run(name, JSON.stringify(data, BufferJSON.replacer));
  };

  const removeData = (name: string) => {
    db.prepare('DELETE FROM auth_state WHERE name = ?').run(name);
  };

  let creds: AuthenticationCreds = readData('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          for (const id of ids) {
            const value = readData(`${type}-${id}`);
            if (value !== null) {
              if (type === 'app-state-sync-key' && value) {
                data[id] = value;
              } else {
                data[id] = value;
              }
            }
          }
          return data;
        },
        set: async (data) => {
          for (const category of Object.keys(data)) {
            const keys = (data as any)[category];
            for (const id of Object.keys(keys)) {
              const value = keys[id];
              const name = `${category}-${id}`;
              if (value) {
                writeData(name, value);
              } else {
                removeData(name);
              }
            }
          }
        }
      }
    },
    saveCreds: () => {
      writeData('creds', creds);
    }
  };
}

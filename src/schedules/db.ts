import Database from 'better-sqlite3';

export class DB {
  private static instance: Database.Database;

  private constructor() {
    DB.instance = new Database('records.sqlite');
  }

  static getInstance(): Database.Database {
    if (!DB.instance) {
      new DB();
    }
    return DB.instance;
  }
}

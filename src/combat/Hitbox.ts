// ============================================================
// Hitbox / Hurtbox — Rectangle definitions for combat collision
// ============================================================

export interface BoxRect {
  x: number;      // offset from fighter center
  y: number;      // offset from fighter center (negative = up)
  width: number;
  height: number;
}

export interface ActiveBox {
  worldX: number;
  worldY: number;
  width: number;
  height: number;
}

export class Hitbox {
  active: boolean = false;
  rect: BoxRect;
  ownerId: string;

  constructor(ownerId: string, rect: BoxRect) {
    this.ownerId = ownerId;
    this.rect = rect;
  }

  getWorldRect(fighterX: number, fighterY: number, facingRight: boolean): ActiveBox {
    const offsetX = facingRight ? this.rect.x : -this.rect.x - this.rect.width;
    return {
      worldX: fighterX + offsetX,
      worldY: fighterY + this.rect.y,
      width: this.rect.width,
      height: this.rect.height,
    };
  }
}

export class Hurtbox {
  rect: BoxRect;
  ownerId: string;

  constructor(ownerId: string, rect: BoxRect) {
    this.ownerId = ownerId;
    this.rect = rect;
  }

  getWorldRect(fighterX: number, fighterY: number, facingRight: boolean): ActiveBox {
    const offsetX = facingRight ? this.rect.x : -this.rect.x - this.rect.width;
    return {
      worldX: fighterX + offsetX,
      worldY: fighterY + this.rect.y,
      width: this.rect.width,
      height: this.rect.height,
    };
  }
}

/** Default hurtbox for a standing fighter */
export const DEFAULT_HURTBOX: BoxRect = {
  x: -45,
  y: -250,
  width: 90,
  height: 250,
};

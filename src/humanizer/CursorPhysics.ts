/**
 * CursorPhysics.ts
 * Implements organic, human-mimicking mouse movements via Cubic Bézier curves,
 * non-center dynamic bounding box selection within a strict 20%-80% safe pad,
 * natural sight-alignment pauses (350ms-1400ms), and micro-overshoots.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BezierOptions {
  steps?: number;
  overshootProbability?: number;
  perpendicularCurvature?: number;
  tremorMagnitude?: number;
}

export class CursorPhysics {
  private currentPosition: Point = { x: 100, y: 100 };

  public getCurrentPosition(): Point {
    return { ...this.currentPosition };
  }

  public setCurrentPosition(point: Point): void {
    this.currentPosition = { ...point };
  }

  /**
   * Dynamically calculates a randomized inner point strictly within a safe 20%-80% inner pad.
   * Strictly avoids static coordinates and exact center points.
   */
  public calculateDynamicTargetPoint(box: BoundingBox): Point {
    // Safe 20% to 80% boundary
    const minX = box.x + box.width * 0.2;
    const maxX = box.x + box.width * 0.8;
    const minY = box.y + box.height * 0.2;
    const maxY = box.y + box.height * 0.8;

    // Blend two uniforms to generate natural Gaussian-like cluster
    const u1 = Math.random();
    const u2 = Math.random();
    const factorX = (u1 + u2) / 2;

    const v1 = Math.random();
    const v2 = Math.random();
    const factorY = (v1 + v2) / 2;

    let targetX = minX + factorX * (maxX - minX);
    let targetY = minY + factorY * (maxY - minY);

    // Apply minor anti-center offset to ensure it never hits exact dead center
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    if (Math.abs(targetX - centerX) < 1.5) {
      targetX += (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 3);
    }
    if (Math.abs(targetY - centerY) < 1.5) {
      targetY += (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 3);
    }

    // Keep within bounds
    targetX = Math.max(minX, Math.min(maxX, targetX));
    targetY = Math.max(minY, Math.min(maxY, targetY));

    return {
      x: Math.round(targetX * 100) / 100,
      y: Math.round(targetY * 100) / 100,
    };
  }

  /**
   * Generates a natural human sight-alignment pause (350ms to 1400ms)
   * prior to dispatching clicks.
   */
  public getSightAlignmentPause(): number {
    return Math.floor(350 + Math.random() * 1050);
  }

  /**
   * Generates a non-linear Cubic Bézier trajectory with human-like wrist arc,
   * variable speed acceleration/deceleration, and optional micro-overshoot.
   */
  public generateTrajectory(start: Point, target: Point, options: BezierOptions = {}): Point[] {
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const baseSteps = Math.max(15, Math.min(80, Math.floor(distance / 12)));
    const steps = options.steps ?? baseSteps;
    const curvature = options.perpendicularCurvature ?? (Math.random() * 0.4 - 0.2);
    const overshootProb = options.overshootProbability ?? 0.35;
    const tremor = options.tremorMagnitude ?? 0.6;

    // Perpendicular vector for natural human wrist arc
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const perpX = -dy * curvature;
    const perpY = dx * curvature;

    // Control point 1 (initial acceleration with slight drift)
    const p1: Point = {
      x: start.x + dx * 0.25 + perpX + (Math.random() - 0.5) * 10,
      y: start.y + dy * 0.25 + perpY + (Math.random() - 0.5) * 10,
    };

    // Control point 2 (cruising path transitioning into targeting)
    let p2: Point = {
      x: start.x + dx * 0.75 + perpX * 0.6 + (Math.random() - 0.5) * 8,
      y: start.y + dy * 0.75 + perpY * 0.6 + (Math.random() - 0.5) * 8,
    };

    // Optional micro-overshoot point
    let destination = { ...target };
    const willOvershoot = distance > 100 && Math.random() < overshootProb;
    if (willOvershoot) {
      const overshootDistance = 3 + Math.random() * 6;
      const angle = Math.atan2(dy, dx);
      destination = {
        x: target.x + Math.cos(angle) * overshootDistance,
        y: target.y + Math.sin(angle) * overshootDistance,
      };
    }

    const points: Point[] = [];

    // Evaluate cubic Bézier curve with ease-in-out time warping
    for (let i = 0; i <= steps; i++) {
      const rawT = i / steps;
      // Smooth step / easing function: S(t) = 3t^2 - 2t^3
      const t = rawT * rawT * (3 - 2 * rawT);

      const oneMinusT = 1 - t;
      const bx =
        Math.pow(oneMinusT, 3) * start.x +
        3 * Math.pow(oneMinusT, 2) * t * p1.x +
        3 * oneMinusT * Math.pow(t, 2) * p2.x +
        Math.pow(t, 3) * destination.x;

      const by =
        Math.pow(oneMinusT, 3) * start.y +
        3 * Math.pow(oneMinusT, 2) * t * p1.y +
        3 * oneMinusT * Math.pow(t, 2) * p2.y +
        Math.pow(t, 3) * destination.y;

      // Micro tremors (subpixel hand jitter)
      const jitterX = (Math.random() - 0.5) * tremor;
      const jitterY = (Math.random() - 0.5) * tremor;

      points.push({
        x: Math.round((bx + jitterX) * 10) / 10,
        y: Math.round((by + jitterY) * 10) / 10,
      });
    }

    // If overshot, add small corrective drift back to target
    if (willOvershoot) {
      const correctionSteps = 4 + Math.floor(Math.random() * 4);
      const lastPoint = points[points.length - 1];
      for (let j = 1; j <= correctionSteps; j++) {
        const ct = j / correctionSteps;
        points.push({
          x: Math.round((lastPoint.x + (target.x - lastPoint.x) * ct) * 10) / 10,
          y: Math.round((lastPoint.y + (target.y - lastPoint.y) * ct) * 10) / 10,
        });
      }
    }

    this.currentPosition = { ...target };
    return points;
  }
}

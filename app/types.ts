export type NodeType =
  | "DOCUMENT"
  | "PAGE"
  | "FRAME"
  | "GROUP"
  | "RECTANGLE"
  | "ELLIPSE"
  | "POLYGON"
  | "STAR"
  | "LINE"
  | "TEXT"
  | "VECTOR"
  | "BOOLEAN_OPERATION"
  | "COMPONENT"
  | "INSTANCE"
  | "IMAGE";

export type BlendMode =
  | "NORMAL"
  | "MULTIPLY"
  | "SCREEN"
  | "OVERLAY"
  | "DARKEN"
  | "LIGHTEN"
  | "COLOR_DODGE"
  | "COLOR_BURN"
  | "HARD_LIGHT"
  | "SOFT_LIGHT"
  | "DIFFERENCE"
  | "EXCLUSION"
  | "HUE"
  | "SATURATION"
  | "COLOR"
  | "LUMINOSITY";

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SolidPaint {
  type: "SOLID";
  color: RGBA;
  opacity: number;
}

export interface GradientStop {
  position: number;
  color: RGBA;
}

export interface GradientPaint {
  type: "LINEAR" | "RADIAL" | "ANGULAR" | "DIAMOND";
  gradientStops: GradientStop[];
  gradientTransform: [number, number, number, number, number, number];
}

export interface ImagePaint {
  type: "IMAGE";
  imageRef: string;
  scaleMode: "FILL" | "FIT" | "CROP" | "TILE";
}

export type Paint = SolidPaint | GradientPaint | ImagePaint;

export interface Effect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  color?: RGBA;
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
}

export interface Constraints {
  horizontal: "MIN" | "MAX" | "CENTER" | "STRETCH" | "SCALE";
  vertical: "MIN" | "MAX" | "CENTER" | "STRETCH" | "SCALE";
}

export interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  children: string[];
}

export interface SceneNode extends BaseNode {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  blendMode: BlendMode;
  fills: Paint[];
  strokes: Paint[];
  strokeWeight: number;
  strokeAlign: "INSIDE" | "OUTSIDE" | "CENTER";
  cornerRadius: number | [number, number, number, number];
  effects: Effect[];
  constraints: Constraints;
  clipContent: boolean;
}

export interface TextNode extends SceneNode {
  type: "TEXT";
  characters: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number | "AUTO";
  letterSpacing: number;
  textAlign: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textDecoration: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textCase: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
}

export type DesignNode = SceneNode | TextNode;

export type ToolType =
  | "SELECT"
  | "FRAME"
  | "RECTANGLE"
  | "ELLIPSE"
  | "LINE"
  | "POLYGON"
  | "STAR"
  | "PEN"
  | "TEXT"
  | "HAND"
  | "ZOOM";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface SmartGuide {
  type: "vertical" | "horizontal";
  position: number;
  from: number;
  to: number;
  label?: string;
}

export interface CanvasDocument {
  formatVersion: string;
  name: string;
  lastModified: string;
  pages: PageData[];
  components: Record<string, string>;
  styles: {
    colors: Record<string, SolidPaint>;
    text: Record<string, Partial<TextNode>>;
    effects: Record<string, Effect[]>;
  };
}

export interface PageData {
  id: string;
  name: string;
  children: string[];
}

export interface HistoryEntry {
  nodes: Map<string, DesignNode>;
  pages: PageData[];
  description: string;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  lastSeen: number;
}

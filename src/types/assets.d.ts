declare module '*.css';

declare module '*.png?inline' {
  const content: string;
  export default content;
}

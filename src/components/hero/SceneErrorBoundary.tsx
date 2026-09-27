import { Component, type ReactNode } from 'react';
import { HeroFallback } from './HeroFallback';
type Props = { children: ReactNode };
type State = { failed: boolean };
export class SceneErrorBoundary extends Component<Props,State> {
  state: State = {failed:false};
  static getDerivedStateFromError():State{return {failed:true};}
  render(){return this.state.failed?<HeroFallback/>:this.props.children;}
}

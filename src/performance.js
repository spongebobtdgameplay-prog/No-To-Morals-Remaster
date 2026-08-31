import * as THREE from "three";

export class PerformanceManager{
  constructor(Renderer,Scene,Camera,Counter){
    this.Renderer = Renderer;
    this.Scene = Scene;
    this.Camera = Camera;
    this.Counter = Counter;
    this.MaxPixelRatio = Math.min(devicePixelRatio || 1,0.96);
    this.MinPixelRatio = Math.min(this.MaxPixelRatio,0.72);
    this.PixelRatio = this.MaxPixelRatio;
    this.Samples = [];
    this.LastFrame = performance.now();
    this.LastPaint = 0;
    this.LastQualityCheck = 0;
    this.LastLightCheck = 0;
    this.HighFpsChecks = 0;
    this.LastWidth = 0;
    this.LastHeight = 0;
    this.TextureBudgetApplied = false;

    this.Renderer.shadowMap.enabled = false;
    this.ApplyRendererSize(true);
  }

  ApplyRendererSize(Force=false){
    if(
      !Force &&
      this.LastWidth === innerWidth &&
      this.LastHeight === innerHeight &&
      Math.abs(this.Renderer.getPixelRatio()-this.PixelRatio) < 0.001
    ) return;

    this.LastWidth = innerWidth;
    this.LastHeight = innerHeight;
    this.Renderer.setPixelRatio(this.PixelRatio);
    this.Renderer.setSize(innerWidth,innerHeight,false);
    this.Renderer.setScissorTest(false);

    const Ratio = Math.max(0.01,this.Renderer.getPixelRatio());
    const Width = Math.max(1,(this.Renderer.domElement.width-1)/Ratio);
    const Height = Math.max(1,(this.Renderer.domElement.height-1)/Ratio);
    this.Renderer.setViewport(0,0,Width,Height);
  }

  Resize(){
    this.ApplyRendererSize(true);
  }

  RefreshSceneBudget(){
    const MaxAnisotropy = Math.min(2,this.Renderer.capabilities.getMaxAnisotropy());

    this.Scene.traverse(Object=>{
      if(Object.isLight) Object.castShadow = false;
      if(!Object.isMesh) return;

      const Materials = Array.isArray(Object.material) ? Object.material : [Object.material];

      for(const Material of Materials){
        if(!Material) continue;

        for(const Key of ["map","normalMap","roughnessMap","metalnessMap","emissiveMap"]){
          const Texture = Material[Key];
          if(!Texture?.isTexture) continue;
          Texture.anisotropy = MaxAnisotropy;
          Texture.needsUpdate = true;
        }
      }
    });

    this.TextureBudgetApplied = true;
    this.CullPointLights();
  }

  FreezeStaticRoots(Roots){
    for(const Root of Roots || []){
      if(!Root?.isObject3D) continue;
      Root.updateMatrixWorld(true);

      Root.traverse(Object=>{
        Object.updateMatrix();
        Object.matrixAutoUpdate = false;
      });
    }
  }

  CullPointLights(){
    const Lights = [];

    this.Scene.traverse(Object=>{
      if(!Object.isPointLight) return;
      const Position = Object.userData.PerformanceWorldPosition ||= new THREE.Vector3();
      Object.getWorldPosition(Position);
      Lights.push({
        Object,
        Distance:Position.distanceToSquared(this.Camera.position)
      });
    });

    Lights.sort((A,B)=>A.Distance-B.Distance);

    for(let Index=0;Index<Lights.length;Index+=1){
      Lights[Index].Object.visible = Index < 3;
    }
  }

  UpdateQuality(Fps){
    if(Fps < 48){
      this.HighFpsChecks = 0;
      const Next = Math.max(this.MinPixelRatio,this.PixelRatio-0.07);

      if(Math.abs(Next-this.PixelRatio) > 0.001){
        this.PixelRatio = Next;
        this.ApplyRendererSize(true);
      }

      return;
    }

    if(Fps >= 58 && this.PixelRatio < this.MaxPixelRatio-0.01){
      this.HighFpsChecks += 1;

      if(this.HighFpsChecks >= 3){
        this.HighFpsChecks = 0;
        this.PixelRatio = Math.min(this.MaxPixelRatio,this.PixelRatio+0.04);
        this.ApplyRendererSize(true);
      }

      return;
    }

    this.HighFpsChecks = 0;
  }

  Frame(Now){
    const Delta = Now-this.LastFrame;
    this.LastFrame = Now;

    if(Delta > 0 && Delta < 250){
      this.Samples.push(Delta);
      while(this.Samples.length > 90) this.Samples.shift();
    }

    if(Now-this.LastLightCheck > 650){
      this.LastLightCheck = Now;
      this.CullPointLights();
    }

    if(!this.Samples.length) return;

    let Sum = 0;
    for(const Sample of this.Samples) Sum += Sample;

    const Average = Sum/this.Samples.length;
    const Fps = 1000/Average;

    if(Now-this.LastQualityCheck > 1500){
      this.LastQualityCheck = Now;
      this.UpdateQuality(Fps);
    }

    if(this.Counter && Now-this.LastPaint > 350){
      this.LastPaint = Now;
      this.Counter.innerHTML =
        "<span>FPS</span><strong>"+Math.round(Fps)+"</strong>"+
        "<small>"+Average.toFixed(1)+" ms · "+this.PixelRatio.toFixed(2)+"×</small>";
    }
  }
}

import * as THREE from "three";

export class PerformanceManager{
  constructor(Renderer,Scene,Camera,Counter){
    this.Renderer = Renderer;
    this.Scene = Scene;
    this.Camera = Camera;
    this.Counter = Counter;
    this.MaxPixelRatio = Math.min(devicePixelRatio || 1,1);
    this.MinPixelRatio = this.MaxPixelRatio;
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

  BatchStaticRoots(Roots){
    const SafeRootNames = new Set([
      "Prop-BrickPlain",
      "Prop-BrickWindow",
      "Prop-BrickWindowTrim",
      "Prop-FloorTile",
      "Prop-Street2Lane",
      "Prop-StreetIntersection",
      "Prop-BuildingLarge",
      "Prop-BuildingMedium",
      "Prop-BuildingSmall"
    ]);
    const Groups = new Map();

    for(const Root of Roots || []){
      if(!Root?.isObject3D || !SafeRootNames.has(Root.name)) continue;
      Root.updateMatrixWorld(true);

      Root.traverse(Object=>{
        if(!Object.isMesh || Object.isSkinnedMesh || !Object.geometry || !Object.material) return;
        if(Array.isArray(Object.material)) return;

        const Key = Object.geometry.uuid+"|"+Object.material.uuid;
        let Group = Groups.get(Key);

        if(!Group){
          Group = {
            Geometry:Object.geometry,
            Material:Object.material,
            Meshes:[]
          };
          Groups.set(Key,Group);
        }

        Group.Meshes.push(Object);
      });
    }

    let BatchedMeshes = 0;
    let BatchDraws = 0;

    for(const Group of Groups.values()){
      if(Group.Meshes.length < 2) continue;

      const Batch = new THREE.InstancedMesh(
        Group.Geometry,
        Group.Material,
        Group.Meshes.length
      );

      Batch.name = "StaticWorldBatch";
      Batch.castShadow = false;
      Batch.receiveShadow = false;
      Batch.frustumCulled = true;
      Batch.matrixAutoUpdate = false;

      for(let Index=0;Index<Group.Meshes.length;Index+=1){
        const Mesh = Group.Meshes[Index];
        Mesh.updateWorldMatrix(true,false);
        Batch.setMatrixAt(Index,Mesh.matrixWorld);
        Mesh.visible = false;
        BatchedMeshes += 1;
      }

      Batch.instanceMatrix.needsUpdate = true;
      Batch.updateMatrix();
      Batch.updateMatrixWorld(true);
      this.Scene.add(Batch);
      BatchDraws += 1;
    }

    this.StaticBatchCount = BatchDraws;
    this.StaticBatchedMeshes = BatchedMeshes;

    return {
      Batches:BatchDraws,
      Meshes:BatchedMeshes
    };
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

  UpdateQuality(){
    this.HighFpsChecks = 0;
    this.PixelRatio = this.MaxPixelRatio;
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
      const Calls = Number(this.Renderer.info.render.calls) || 0;
      const Triangles = Number(this.Renderer.info.render.triangles) || 0;
      this.Counter.innerHTML =
        "<span>FPS</span><strong>"+Math.round(Fps)+"</strong>"+
        "<small>"+Average.toFixed(1)+" ms · "+this.PixelRatio.toFixed(2)+"× · "+
        Calls+" calls · "+Math.round(Triangles/1000)+"k tris · "+
        (this.StaticBatchCount || 0)+" batches</small>";
    }
  }
}

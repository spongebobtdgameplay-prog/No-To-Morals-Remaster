import * as THREE from "three";
import {GameConfig} from "./config.js";
import {CollisionWorld} from "./collision.js";
import {CharacterAssets} from "./assets.js";
import {BankWorld} from "./world.js";
import {PlayerController} from "./player.js";
import {VaultSystem,GearSystem,LootSystem,PoliceSystem,GameUi} from "./systems.js";

const Canvas = document.getElementById("GameCanvas");
const Renderer = new THREE.WebGLRenderer({canvas:Canvas,antialias:true,powerPreference:"high-performance"});
Renderer.setPixelRatio(Math.min(devicePixelRatio,2));
Renderer.setSize(innerWidth,innerHeight);
Renderer.shadowMap.enabled = true;
Renderer.shadowMap.type = THREE.PCFSoftShadowMap;
Renderer.outputColorSpace = THREE.SRGBColorSpace;
Renderer.toneMapping = THREE.ACESFilmicToneMapping;
Renderer.toneMappingExposure = 1.05;

const Scene = new THREE.Scene();
const Camera = new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.05,160);
Camera.position.set(0,2.2,20);

const Collision = new CollisionWorld();
const World = new BankWorld(Scene,Collision);
const Assets = new CharacterAssets();
const Player = new PlayerController(Camera,Canvas,Collision);
const Ui = new GameUi();
const Vault = new VaultSystem(Scene,Collision);
const Gear = new GearSystem(World);
const Loot = new LootSystem(World);
const Police = new PoliceSystem(Scene,Collision,Assets,World,Vault);

let Running = false;
let Ended = false;
let AlarmTime = 0;
let LastTime = performance.now();

function Resize(){
  Renderer.setSize(innerWidth,innerHeight);
  Camera.aspect = innerWidth/innerHeight;
  Camera.updateProjectionMatrix();
}
addEventListener("resize",Resize);

function UpdateObjective(){
  if(!Gear.Equipped){
    Ui.SetObjective("Get breach gear.");
    return;
  }

  if(!Vault.IsPassable()){
    const Percent = Math.round((1-Vault.RemainingFraction())*100);
    Ui.SetObjective("Open a low passage through the vault. "+Percent+"% fractured.");
    return;
  }

  if(Loot.Count < 1){
    Ui.SetObjective("Enter the vault and take loot.");
    return;
  }

  Ui.SetObjective("Reach the getaway van.");
}

function CheckEscape(){
  if(Loot.Count < 1) return false;

  const FlatPlayer = new THREE.Vector2(Player.Position.x,Player.Position.z);
  const FlatVan = new THREE.Vector2(World.VanPosition.x,World.VanPosition.z);
  return FlatPlayer.distanceTo(FlatVan) < 2.7;
}

function Finish(Win){
  if(Ended) return;

  Ended = true;
  Running = false;
  Player.SetActive(false);

  if(document.pointerLockElement === Canvas) document.exitPointerLock?.();
  Ui.End(Win,Loot.Count);
}

async function Boot(){
  try{
    Ui.BootStatus.textContent = "Loading character and environment models...";

    await Promise.all([
      Assets.Load(),
      World.LoadModels()
    ]);

    const Robber = Assets.Create("Robber");
    Player.AttachCharacter(Robber,Scene);
    Ui.SetReady();
  }catch(Error){
    Ui.Error(Error);

    try{
      const Robber = Assets.Create("Robber");
      Player.AttachCharacter(Robber,Scene);
    }catch(CharacterError){
      Ui.Error(CharacterError);
    }

    Ui.SetReady();
  }
}

Ui.StartButton.addEventListener("click",()=>{
  Ui.Start();
  Ui.SetLoot(0,GameConfig.LootCount);
  Running = true;
  Ended = false;
  Player.SetActive(true);
  Canvas.requestPointerLock?.();
});

Ui.RestartButton.addEventListener("click",()=>location.reload());

Canvas.addEventListener("click",()=>{
  if(Running && document.pointerLockElement !== Canvas) Canvas.requestPointerLock?.();
});

function Frame(Now){
  requestAnimationFrame(Frame);

  const Delta = Math.min((Now-LastTime)/1000,0.05);
  LastTime = Now;

  Vault.Update(Delta);

  if(Running && !Ended){
    Ui.SetPrompt("");
    Player.Update(Delta);
    Ui.SetStamina(Player.Stamina);

    Gear.Update(Player,Ui);

    if(Gear.Equipped && Player.ConsumeFire()){
      const Result = Vault.Pulse(Player);
      if(Result.Fired) Player.TriggerToolPulse();

      if(Result.Hit && Vault.AlarmTriggered && AlarmTime === 0){
        AlarmTime = 0.0001;
      }
    }else{
      Player.ConsumeFire();
    }

    Loot.Update(Player,Ui);

    if(AlarmTime > 0){
      AlarmTime += Delta;

      const Remaining = Math.max(0,GameConfig.PoliceResponseDelay-AlarmTime);
      Ui.SetAlarm(true,Remaining);

      if(AlarmTime >= GameConfig.PoliceResponseDelay) Police.Deploy();
    }else{
      Ui.SetAlarm(false,0);
    }

    const Caught = Police.Update(Delta,Player);

    if(Caught) Finish(false);
    if(CheckEscape()) Finish(true);

    UpdateObjective();
  }

  Renderer.render(Scene,Camera);
}

Boot();
requestAnimationFrame(Frame);

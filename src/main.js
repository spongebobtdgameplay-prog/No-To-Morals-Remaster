import * as THREE from "three";
import {GameConfig} from "./config.js?v=20260830-v014";
import {CollisionWorld} from "./collision.js?v=20260830-v014";
import {CharacterAssets} from "./assets.js?v=20260830-v013";
import {BankWorld} from "./world.js?v=20260830-v014";
import {PlayerController} from "./player.js?v=20260830-v014";
import {VaultSystem,GearSystem,LootSystem,PoliceSystem,GameUi} from "./systems.js?v=20260830-v014";

const Canvas = document.getElementById("GameCanvas");
const Renderer = new THREE.WebGLRenderer({canvas:Canvas,antialias:true,powerPreference:"high-performance"});
Renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
Renderer.setSize(innerWidth,innerHeight);
Renderer.shadowMap.enabled = true;
Renderer.shadowMap.type = THREE.PCFSoftShadowMap;
Renderer.outputColorSpace = THREE.SRGBColorSpace;
Renderer.toneMapping = THREE.ACESFilmicToneMapping;
Renderer.toneMappingExposure = 1.28;

const Scene = new THREE.Scene();
const Camera = new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.05,160);
Camera.position.set(0,2.2,8);

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
    Ui.SetObjective("Get the access device.");
    return;
  }

  if(!Vault.IsPassable()){
    const Percent = Math.round((1-Vault.RemainingFraction())*100);
    Ui.SetObjective("Override the security gate. "+Percent+"% complete.");
    return;
  }

  if(Loot.Count < GameConfig.RequiredLoot){
    const Needed = GameConfig.RequiredLoot-Loot.Count;
    Ui.SetObjective("Take "+Needed+" more loot crate"+(Needed===1?".":"s."));
    return;
  }

  Ui.SetObjective("Reach the street-side escape point.");
}

function CheckEscape(){
  if(Loot.Count < GameConfig.RequiredLoot) return false;

  const FlatPlayer = new THREE.Vector2(Player.Position.x,Player.Position.z);
  const FlatEscape = new THREE.Vector2(World.EscapePosition.x,World.EscapePosition.z);
  return FlatPlayer.distanceTo(FlatEscape) < 2.7;
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
  Ui.StartButton.disabled = true;
  Ui.StartButton.textContent = "LOADING GAME";
  Ui.BootStatus.textContent = "Loading and decoding required models...";

  try{
    await Promise.all([
      Assets.Load(),
      World.LoadModels()
    ]);

    if(!World.VaultDoorModel){
      throw new Error("Vault door model did not initialize.");
    }

    Vault.AttachDoor(World.VaultDoorModel);

    const Robber = Assets.Create("Robber");
    Player.AttachCharacter(Robber,Scene);
    Player.AttachLootBag(Assets.CreateLootBag());
    Ui.SetReady();
  }catch(Error){
    console.error("Boot failed.",Error);
    Ui.SetBootFailure(Error);
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
    Vault.UpdateInteraction(Player,Ui,Gear.Equipped);

    if(Vault.AlarmTriggered && AlarmTime === 0){
      AlarmTime = 0.0001;
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

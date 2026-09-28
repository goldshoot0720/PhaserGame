export const CHARACTERS = [
  { key: 'luna', name: '小鯨' },
  { key: 'penguin', name: '企鵝妹' },
  { key: 'xiang', name: '眼鏡哥' },
  { key: 'zhe', name: '阿弟' },
  { key: 'calico', name: '三花貓' },
  { key: 'whitecat', name: '白貓' },
  { key: 'xiaohong', name: '紅貓娘' },
  { key: 'yukino', name: '水手服' },
];

export function preloadCharacters(scene) {
  for (const character of CHARACTERS) {
    scene.load.image(character.key, `/assets/characters/${character.key}.png`);
  }
}

import sharp from 'sharp';
const comps=[];
for(let i=1;i<=8;i++) comps.push({input:`public/assets/heads/c${i}.png`,left:((i-1)%4)*266+5,top:Math.floor((i-1)/4)*266+5});
await sharp({create:{width:1070,height:536,channels:4,background:{r:40,g:140,b:60,alpha:1}}}).composite(comps).png().toFile(process.argv[2]);

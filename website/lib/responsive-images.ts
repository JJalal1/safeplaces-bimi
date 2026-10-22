import profiles from '../data/responsive-images.json';

export const catalogImageSizes='(max-width: 650px) 44vw, (max-width: 1000px) 30vw, 280px';

/** Only bundled originals have generated variants; uploaded/CMS images keep working. */
export function responsiveImage(src:string,sizes=catalogImageSizes):{srcSet?:string;sizes?:string}{
 const profile=profiles.find(item=>item.src===src);
 return profile?{srcSet:profile.widths.map(width=>'/images/responsive/'+profile.name+'-'+width+'.webp '+width+'w').join(', '),sizes}:{};
}

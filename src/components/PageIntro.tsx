import '../pageIntro.css';

/** Shared title and description treatment for the Journal and Passport. */
export function PageIntro({title,description}:{title:string;description:string}){
  return <header className="page-intro"><h1>{title}</h1><p>{description}</p></header>;
}

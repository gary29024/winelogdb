import { NavLink, Outlet } from 'react-router-dom';
export function Layout(){return <><header><a className="brand" href="/">WineLog</a><nav aria-label="Main navigation"><NavLink to="/">Library</NavLink><NavLink to="/upload">Add labels</NavLink></nav></header><main><Outlet/></main><footer>Your private tasting notebook</footer></>}

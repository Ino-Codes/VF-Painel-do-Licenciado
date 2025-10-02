import React from "react";

type StateAbbr = "rs" | "sc" | "sp" | "todos";

interface MapaProps {
  activeState: StateAbbr;
  onStateClick: (state: StateAbbr) => void;
}

const MapaEscritorios: React.FC<MapaProps> = ({
  activeState,
  onStateClick,
}) => {
  const states = [
    {
      id: "sp",
      name: "São Paulo",
      path: "M175.7,5.3l-20.4,21.3l-18.8,11.5l-13.4,13.2l-20.9,13.2l-1.6,4.7l-4.7,0.7l-6.2,2.3l-3.1,3.1l-6.2,3.9l-23.4,10.1l-10.9,1.6l-11.7-1.6l-7-3.9l-10.9-10.1l3.1-4.7l-1.6-4.7l-4.7-3.1l-6.2-7l-3.1-13.2l5.5-12.4l14-5.5l14.8,2.3l12.4,5.5l14.8,7.8l21.7,4.7l13.2-1.6l10.9,3.1L175.7,5.3z",
    },
    {
      id: "pr",
      name: "Paraná",
      path: "M133.5,91.8l-21.7,12.4l-31,3.9l-31-4.7l-13.2-11.7l-7-10.1l11.7-11.7l7-3.9l10.9,10.1l10.9,1.6l11.7,1.6l23.4-10.1l6.2-3.9l3.1-3.1l6.2-2.3l4.7-0.7l1.6-4.7l2.3,1.6L133.5,91.8z",
    },
    {
      id: "sc",
      name: "Santa Catarina",
      path: "M111.8,104.2l-31-4.7l-31-3.9l-1.6,8.6l-7,10.1l-4.7,14l-2.3,14.8l10.1,13.2l20.2,3.1l28,1.6l14.8-10.9l10.1-14l3.9-14.8l-1.6-13.2L111.8,104.2z",
    },
    {
      id: "rs",
      name: "Rio Grande do Sul",
      path: "M79.3,130.8l-1.6,8.6l-7,10.1l-4.7,14l-2.3,14.8l1.6,15.5l9.3,18.6l13.2,12.4l14.8,8.6l20.2,4.7l13.2-5.5l2.3-10.1l-4.7-12.4l-11.7-10.1l-14.8-10.1l-13.2-13.2l-10.1-13.2L79.3,130.8z",
    },
  ];

  return (
    <div className="map-container">
      <svg className="map-svg" viewBox="0 0 180 250">
        {states.map((state) => (
          <path
            key={state.id}
            d={state.path}
            className={`${state.id !== "pr" ? "interactive" : ""} ${
              activeState === state.id ? "active" : ""
            }`}
            onClick={() =>
              state.id !== "pr" && onStateClick(state.id as StateAbbr)
            }
          />
        ))}
      </svg>
    </div>
  );
};

export default MapaEscritorios;

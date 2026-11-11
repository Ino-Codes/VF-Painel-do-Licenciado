import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { FiZoomIn, FiRotateCw } from "react-icons/fi";
import { AreaPixels } from "./cortarImagem.ts";

// Editor de imagem no estilo do LinkedIn: arrastar para enquadrar, zoom e
// giro. Usado pela capa (moldura 4:1) e pela foto de perfil (moldura
// redonda 1:1). Quem usa recebe a área recortada e o giro em `onChange` e
// gera o arquivo final com `cortarImagem`.
//
// Para começar do zero com outra imagem, quem usa troca a `key`.

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

export interface Recorte {
  area: AreaPixels;
  rotacao: number;
}

interface Props {
  imagem: string;
  /** Proporção da moldura (largura ÷ altura): 4 para a capa, 1 para a foto. */
  proporcao: number;
  formato?: "rect" | "round";
  onChange: (recorte: Recorte) => void;
  /** Ações extras no fim da coluna de controles (ex.: "Trocar imagem"). */
  extras?: React.ReactNode;
}

const EditorDeImagem: React.FC<Props> = ({ imagem, proporcao, formato = "rect", onChange, extras }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotacao, setRotacao] = useState(0);
  const [area, setArea] = useState<AreaPixels | null>(null);

  // A área vem do Cropper; o giro, do estado daqui. Os dois juntos vão para
  // quem usa sempre que um deles muda.
  const aoRecortar = useCallback(
    (_: unknown, pixels: AreaPixels) => {
      setArea(pixels);
      onChange({ area: pixels, rotacao });
    },
    [onChange, rotacao],
  );

  const girar = (graus: number) => {
    setRotacao(graus);
    if (area) onChange({ area, rotacao: graus });
  };

  return (
    <div className={`img-editor${formato === "round" ? " img-editor--redondo" : ""}`}>
      <div className="img-editor-area">
        <Cropper
          image={imagem}
          crop={crop}
          zoom={zoom}
          rotation={rotacao}
          aspect={proporcao}
          cropShape={formato}
          minZoom={ZOOM_MIN}
          maxZoom={ZOOM_MAX}
          objectFit={proporcao >= 1.5 ? "horizontal-cover" : "contain"}
          showGrid={formato === "rect"}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={girar}
          onCropComplete={aoRecortar}
          classes={{ cropAreaClassName: "img-editor-moldura" }}
        />
      </div>

      <div className="img-editor-controles">
        <p className="img-editor-dica">Arraste a imagem para enquadrar.</p>

        <div className="img-editor-controle">
          <label htmlFor="img-editor-zoom">
            <FiZoomIn aria-hidden="true" /> Zoom
            <span className="img-editor-valor">{Math.round(zoom * 100)}%</span>
          </label>
          <input
            id="img-editor-zoom"
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-valuetext={`${Math.round(zoom * 100)}%`}
          />
        </div>

        <div className="img-editor-controle">
          <label htmlFor="img-editor-girar">
            <FiRotateCw aria-hidden="true" /> Girar
            <span className="img-editor-valor">{rotacao}°</span>
          </label>
          <input
            id="img-editor-girar"
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotacao}
            onChange={(e) => girar(Number(e.target.value))}
            aria-valuetext={`${rotacao} graus`}
          />
          {rotacao !== 0 && (
            <button type="button" className="img-editor-endireitar" onClick={() => girar(0)}>
              Endireitar
            </button>
          )}
        </div>

        {extras}
      </div>
    </div>
  );
};

export default EditorDeImagem;

import React from "react";
import Lottie from "lottie-react";
// Importe o arquivo JSON da sua animação
import loadingAnimation from "./animations/loading.json";

const LoadingSpinner: React.FC = () => {
  const style = {
    height: 200, // Defina o tamanho que desejar
    width: 200,
  };

  return (
    <div className="tela-loading">
      <Lottie animationData={loadingAnimation} loop={true} style={style} />
      <span>Carregando...</span>
    </div>
  );
};

export default LoadingSpinner;

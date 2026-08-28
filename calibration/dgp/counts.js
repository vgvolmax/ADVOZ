'use strict';

function samplePoisson(lambda,rng){
  const x=Number(lambda);if(!(x>=0)||!Number.isFinite(x))throw new TypeError('Poisson lambda must be finite and >= 0');
  if(x===0)return 0;
  if(x>30){
    const parts=Math.ceil(x/25),part=x/parts;let sum=0;
    for(let i=0;i<parts;i++)sum+=samplePoisson(part,rng);
    return sum;
  }
  const limit=Math.exp(-x);let k=0,p=1;
  do{k++;p*=rng.uniform()}while(p>limit);
  return k-1;
}
function sampleGamma(shape,scale,rng){
  let k=Number(shape),theta=Number(scale);
  if(!(k>0)||!(theta>0)||!Number.isFinite(k)||!Number.isFinite(theta))throw new TypeError('Gamma shape/scale must be positive');
  if(k<1){const u=Math.max(Number.EPSILON,rng.uniform());return sampleGamma(k+1,theta,rng)*Math.pow(u,1/k)}
  const d=k-1/3,c=1/Math.sqrt(9*d);
  for(;;){
    let z,v;do{z=rng.normal();v=1+c*z}while(v<=0);v=v*v*v;
    const u=rng.uniform();
    if(u<1-.0331*z*z*z*z)return theta*d*v;
    if(Math.log(u)<.5*z*z+d*(1-v+Math.log(v)))return theta*d*v;
  }
}
function sampleGammaPoisson(mean,overdispersion,rng){
  const mu=Number(mean),od=Math.max(0,Number(overdispersion)||0);
  if(!(mu>=0)||!Number.isFinite(mu))throw new TypeError('mean must be finite and >= 0');
  if(mu===0)return 0;if(od<=1e-12)return samplePoisson(mu,rng);
  const shape=1/od,scale=mu/shape,latent=sampleGamma(shape,scale,rng);
  return samplePoisson(latent,rng);
}
module.exports={samplePoisson,sampleGammaPoisson,_internals:{sampleGamma}};

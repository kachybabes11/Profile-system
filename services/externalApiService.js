import axios from "axios";

export async function fetchExternalData(name) {
  const [genderRes, ageRes, nationRes] = await Promise.all([
    axios.get(`https://api.genderize.io?name=${name}`),
    axios.get(`https://api.agify.io?name=${name}`),
    axios.get(`https://api.nationalize.io?name=${name}`)
  ]);

  return {
    gender: genderRes.data,
    age: ageRes.data,
    nationality: nationRes.data
  };
}
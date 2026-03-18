import {useEffect, useState} from "react";
import axios from "axios";

export const App = () => {
  const [tables, setTables] = useState([]);

  useEffect(() => {
      axios.get('/api/tables').then(res => setTables(res.data))
  }, [])

  return (
    <div>
      <h1>Tables</h1>
      { tables.map(table => <div key={table.id}>{JSON.stringify(table)}</div>)}
    </div>
  );
}

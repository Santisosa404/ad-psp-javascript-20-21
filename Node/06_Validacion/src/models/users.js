
class User {

    // modificamos el constructor, dejando el id al final para hacerlo optativo
    constructor(username, email, id=0) {
        this.id = id;
        this.username = username;
        // Añadimos el email como un atributo más
        this.email = email;
    }


}

let users = [
    new User('Luis Miguel López', 'luismi@email.com', 1),
    new User('Ángel Naranjo', 'angel@email.com', 2)
];

/**
 * Método que nos va a permitir obtener la posición de un 
 * usuario dentro de la colección en base a su ID
 * Devuelve la posición si lo encuentra, y -1 si no lo encuentra.
 */
const indexOfPorId = (id) => {
    let posicionEncontrado = -1;
    for (let i = 0; i < users.length && posicionEncontrado == -1; i++) {
        if (users[i].id == id)
            posicionEncontrado = i;
    }
    return posicionEncontrado;
}

/**
 * Función que comprueba si un email ya está
 * definido como el email de un usuario en el repositorio
 */
const emailExists = (email) => {
    let emails = users.map(user => user.email);
    return emails.includes(email);
}


const userRepository = {

    // Devuelve todos los usuarios del repositorio
    findAll() {
        return users;
    },
    // Devuelve un usuario por su Id
    findById(id) {
       const posicion = indexOfPorId(id);
       return posicion == -1 ? undefined : users[posicion];
    },
    // Inserta un nuevo usuario y devuelve el usuario insertado
    create(newUser) {
        const lastId = users.length == 0 ? 0 : users[users.length-1].id;
        const newId = lastId + 1;
        const result = new User(newUser.username, newUser.email, newId);
        users.push(result);
        return result;
    },
    // Actualiza un usuario identificado por su ID
    updateById(id, modifiedUser) {
        const posicionEncontrado = indexOfPorId(id)
        if (posicionEncontrado != -1) {
            users[posicionEncontrado].username = modifiedUser.username;
        }
        return posicionEncontrado != -1 ? users[posicionEncontrado] : undefined;
    },
    // Versión del anterior, en la que el ID va dentro del objeto usuario
    update(modifiedUser) {
        return this.update(modifiedUser.id, modifiedUser);
    }, 
    delete(id) {
        const posicionEncontrado = indexOfPorId(id);
        if (posicionEncontrado != -1)
            users.splice(posicionEncontrado, 1);
    }

}


export  {
    User,
    userRepository,
    emailExists
}